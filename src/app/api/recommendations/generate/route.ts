import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildTasteProfile } from '@/lib/taste-profile';
import { generateRecommendations, generateRefinement } from '@/lib/llm';
import { searchByCategory, getWatchProviders } from '@/lib/tmdb';

export const maxDuration = 60;
import { COOLDOWN_DAYS, MAX_RECOMMENDATION_COUNT } from '@/lib/constants';
import {
  computeRatingDistribution,
  shouldRegenerateFingerprint,
  generateTasteFingerprint,
  generateMissAnalysis,
} from '@/lib/taste-fingerprint';
import {
  formatCollaborativeSignals,
  getCachedCollaborativeSignals,
} from '@/lib/collaborative';
import { fetchOMDBByTitle, computeQualityScore } from '@/lib/omdb';
import { computeUserTagWeights } from '@/lib/tag-efficacy';
import {
  generateCategoryFingerprint,
  formatCategoryFingerprint,
  shouldRegenerateCategoryFingerprint,
  CATEGORY_FINGERPRINT_MIN_RATINGS,
} from '@/lib/category-fingerprints';

export async function POST(request: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category, genre, intent, refinement, sessionId } = await request.json();

  if (!category) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  }

  // --- Phase 1: Parallel initial data fetch ---
  const [
    profileResult,
    ratingsResult,
    fingerprintResult,
    feedbackRecsResult,
    notInterestedResult,
    cooldownsResult,
    sessionResult,
    prevRecsResult,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('tier, monthly_request_count, monthly_request_limit')
      .eq('id', user.id)
      .single(),
    supabase
      .from('ratings')
      .select('*, item:items(*)')
      .eq('user_id', user.id),
    supabase
      .from('taste_fingerprints')
      .select('*')
      .eq('user_id', user.id)
      .is('category', null)
      .single(),
    supabase
      .from('recommendations')
      .select('confidence, feedback')
      .eq('user_id', user.id)
      .not('feedback', 'is', null)
      .not('confidence', 'is', null),
    supabase
      .from('recommendations')
      .select('item:items(title)')
      .eq('user_id', user.id)
      .eq('status', 'not_interested'),
    supabase
      .from('recommendation_cooldowns')
      .select('item:items(title)')
      .eq('user_id', user.id),
    sessionId
      ? supabase
          .from('conversation_sessions')
          .select('messages')
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('recommendations')
      .select('item:items(title, external_id, category)')
      .eq('user_id', user.id)
      .gt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const profile = profileResult.data;
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const ratings = ratingsResult.data;
  if (!ratings || ratings.length === 0) {
    return NextResponse.json(
      { error: 'Rate some items first to get recommendations' },
      { status: 400 }
    );
  }

  const ratingsWithItems = ratings.map((r) => ({ ...r, item: r.item }));
  const fingerprintRecord = fingerprintResult.data;

  // --- Phase 2: Parallel secondary computations ---
  const distribution = computeRatingDistribution(ratingsWithItems);

  // Confidence calibration (sync computation from already-fetched data)
  let calibration: { high: number | null; medium: number | null; low: number | null; total: number } | null = null;
  const feedbackRecs = feedbackRecsResult.data;
  if (feedbackRecs && feedbackRecs.length >= 5) {
    const byConfidence: Record<string, { good: number; total: number }> = {};
    for (const r of feedbackRecs) {
      const c = r.confidence || 'unknown';
      if (!byConfidence[c]) byConfidence[c] = { good: 0, total: 0 };
      byConfidence[c].total++;
      if (r.feedback === 'good') byConfidence[c].good++;
    }
    calibration = {
      high: byConfidence['high'] ? byConfidence['high'].good / byConfidence['high'].total : null,
      medium: byConfidence['medium'] ? byConfidence['medium'].good / byConfidence['medium'].total : null,
      low: byConfidence['low'] ? byConfidence['low'].good / byConfidence['low'].total : null,
      total: feedbackRecs.length,
    };
  }

  // Exclusion lists (sync computation from already-fetched data)
  const notInterestedTitles = (notInterestedResult.data || [])
    .map((r) => (r.item as unknown as { title: string })?.title)
    .filter(Boolean);

  const previouslyRecommendedTitles = (cooldownsResult.data || [])
    .map((c) => (c.item as unknown as { title: string })?.title)
    .filter(Boolean);

  const ratedTitles = ratingsWithItems
    .filter((r) => r.item?.category === category)
    .map((r) => r.item?.title)
    .filter(Boolean);

  const allExcluded = [...new Set([...previouslyRecommendedTitles, ...ratedTitles])];

  // Conversation history (from already-fetched data)
  let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  if (sessionResult.data?.messages) {
    conversationHistory = sessionResult.data.messages as { role: 'user' | 'assistant'; content: string }[];
  }

  // Previous rec titles (from already-fetched data)
  const prevRecTitles = new Set(
    (prevRecsResult.data || [])
      .filter((r) => {
        const item = r.item as unknown as { category: string };
        return item?.category === category;
      })
      .map((r) => (r.item as unknown as { title: string })?.title?.toLowerCase())
      .filter(Boolean)
  );

  // --- Phase 3: Fingerprint + parallel side work ---
  let fingerprint = fingerprintRecord?.fingerprint || null;
  let tasteThesis = fingerprintRecord?.taste_thesis || null;
  let evolutionNotes = fingerprintRecord?.evolution_notes || null;
  let crossCategoryPatterns = fingerprintRecord?.cross_category_patterns || null;
  let missAnalysis = fingerprintRecord?.miss_analysis || null;

  const ratingsAtGen = fingerprintRecord?.ratings_count_at_generation || 0;

  // Bad feedback count + collaborative signals + tag weights in parallel
  const [badFeedbackResult, collaborativeSignals, userTagWeights] = await Promise.all([
    supabase
      .from('recommendations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feedback', 'bad')
      .gt('created_at', fingerprintRecord?.generated_at || '2000-01-01'),
    // Use cached collaborative signals instead of recomputing
    getCachedCollaborativeSignals(supabase, user.id, category).catch(() => []),
    computeUserTagWeights(supabase, user.id, category).catch(() => null),
  ]);

  const collaborativeSection = formatCollaborativeSignals(collaborativeSignals);

  const needsRegen = !fingerprint || shouldRegenerateFingerprint(
    ratings.length,
    ratingsAtGen,
    badFeedbackResult.count || 0
  );

  if (needsRegen) {
    try {
      const result = await generateTasteFingerprint(
        ratingsWithItems,
        fingerprint
      );
      fingerprint = result.fingerprint;
      tasteThesis = result.tasteThesis;
      evolutionNotes = result.evolutionNotes;
      crossCategoryPatterns = result.crossCategoryPatterns;

      // Generate miss analysis if there are bad recs
      const { data: badRecs } = await supabase
        .from('recommendations')
        .select('item:items(title, genres), feedback_reason')
        .eq('user_id', user.id)
        .eq('feedback', 'bad');

      if (badRecs && badRecs.length > 0) {
        const missData = badRecs.map((r) => ({
          title: (r.item as unknown as { title: string })?.title || '',
          reason: r.feedback_reason,
          genres: (r.item as unknown as { genres: string[] })?.genres || [],
        }));
        missAnalysis = await generateMissAnalysis(missData);
      }

      // Save updated fingerprint
      const newVersion = (fingerprintRecord?.fingerprint_version || 0) + 1;
      const previousFingerprints = fingerprintRecord?.previous_fingerprints || [];
      if (fingerprintRecord?.fingerprint) {
        previousFingerprints.push({
          fingerprint: fingerprintRecord.fingerprint,
          generated_at: fingerprintRecord.generated_at,
          ratings_count: ratingsAtGen,
        });
        // Keep last 5 versions
        if (previousFingerprints.length > 5) previousFingerprints.shift();
      }

      const upsertData = {
        user_id: user.id,
        category: null,
        fingerprint,
        generated_at: new Date().toISOString(),
        ratings_count_at_generation: ratings.length,
        fingerprint_version: newVersion,
        evolution_notes: evolutionNotes,
        taste_thesis: tasteThesis,
        cross_category_patterns: crossCategoryPatterns,
        miss_analysis: missAnalysis,
        rating_distribution: distribution,
        previous_fingerprints: previousFingerprints,
      };

      if (fingerprintRecord) {
        await supabase
          .from('taste_fingerprints')
          .update(upsertData)
          .eq('id', fingerprintRecord.id);
      } else {
        await supabase
          .from('taste_fingerprints')
          .insert(upsertData);
      }
    } catch (err) {
      console.error('Fingerprint regen failed:', err);
    }
  }

  // --- Per-category fingerprint ---
  let categoryFingerprintSection: string | null = null;
  try {
    const categoryRatings = ratingsWithItems.filter((r) => {
      const cat = r.item.category;
      if (category === 'books') return ['books', 'fiction_books', 'nonfiction_books'].includes(cat);
      if (category === 'movies') return ['movies', 'documentaries'].includes(cat);
      return cat === category;
    });

    if (categoryRatings.length >= CATEGORY_FINGERPRINT_MIN_RATINGS) {
      const { data: catFpRecord } = await supabase
        .from('taste_fingerprints')
        .select('fingerprint, ratings_count_at_generation, fingerprint_version')
        .eq('user_id', user.id)
        .eq('category', category)
        .single();

      let catFingerprint = catFpRecord?.fingerprint;
      const catRatingsAtGen = catFpRecord?.ratings_count_at_generation || 0;

      const needsCatRegen = !catFingerprint ||
        shouldRegenerateCategoryFingerprint(categoryRatings.length, catRatingsAtGen);

      if (needsCatRegen) {
        const result = await generateCategoryFingerprint(
          categoryRatings,
          category,
          tasteThesis,
          catFpRecord?.fingerprint || null,
          catRatingsAtGen
        );

        if (result) {
          catFingerprint = result.fingerprint;
          const upsertData = {
            user_id: user.id,
            category,
            fingerprint: result.fingerprint,
            generated_at: new Date().toISOString(),
            ratings_count_at_generation: categoryRatings.length,
            fingerprint_version: (catFpRecord?.fingerprint_version || 0) + 1,
            evolution_notes: result.evolutionNotes,
          };

          if (catFpRecord) {
            await supabase.from('taste_fingerprints').update(upsertData)
              .eq('user_id', user.id).eq('category', category);
          } else {
            await supabase.from('taste_fingerprints').insert(upsertData);
          }
        }
      }

      if (catFingerprint) {
        categoryFingerprintSection = formatCategoryFingerprint(catFingerprint, category);
      }
    }
  } catch (err) {
    console.error('Category fingerprint error:', err);
  }

  // --- Build taste profile ---
  const tasteProfile = buildTasteProfile(
    ratingsWithItems,
    notInterestedTitles,
    allExcluded,
    missAnalysis,
    category,
    genre || null,
    intent || null,
    fingerprint,
    tasteThesis,
    evolutionNotes,
    crossCategoryPatterns,
    distribution,
    calibration,
    collaborativeSection,
    userTagWeights,
    categoryFingerprintSection,
  );

  // --- Generate recommendations ---
  let llmResponse;
  try {
    if (refinement && conversationHistory.length > 0) {
      const prevRecsText = conversationHistory
        .filter((m) => m.role === 'assistant')
        .map((m) => m.content)
        .join('\n');
      llmResponse = await generateRefinement(refinement, prevRecsText, conversationHistory, profile.tier);
    } else {
      llmResponse = await generateRecommendations(tasteProfile, profile.tier, conversationHistory);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('LLM error:', message);
    return NextResponse.json({ error: `Failed to generate recommendations: ${message}` }, { status: 500 });
  }

  // --- Process recommendations (parallelized) ---
  const batchId = crypto.randomUUID();
  const isTmdbCategory = ['movies', 'tv_shows', 'documentaries'].includes(category);

  console.log(`[generate] LLM returned ${llmResponse.recommendations.length} recs for ${category}`);

  // Step 1: Search all recommendations in parallel
  const searchResults = await Promise.allSettled(
    llmResponse.recommendations.map(async (rec) => {
      const results = await searchByCategory(category, rec.title);
      return { rec, results };
    })
  );

  // Step 2: Validate and deduplicate (must be sequential for dedup)
  const usedTitles = new Set<string>();
  const usedExternalIds = new Set<string>();

  interface ValidatedSearch {
    rec: typeof llmResponse.recommendations[0];
    match: Awaited<ReturnType<typeof searchByCategory>>[0];
  }

  const validatedSearches: ValidatedSearch[] = [];

  for (const result of searchResults) {
    if (result.status !== 'fulfilled') continue;
    const { rec, results } = result.value;

    if (usedTitles.has(rec.title.toLowerCase())) continue;
    if (prevRecTitles.has(rec.title.toLowerCase())) continue;

    const recTitle = rec.title.toLowerCase();
    const match =
      results.find((s) => s.title.toLowerCase() === recTitle) ||
      results.find((s) => s.title.toLowerCase().includes(recTitle)) ||
      results.find((s) => recTitle.includes(s.title.toLowerCase())) ||
      results[0];

    if (!match) continue;
    if (usedExternalIds.has(match.external_id)) continue;

    validatedSearches.push({ rec, match });
    usedTitles.add(match.title.toLowerCase());
    usedExternalIds.add(match.external_id);
  }

  // Step 3: Process all validated candidates in parallel (DB checks + quality scores)
  interface ValidCandidate {
    rec: typeof llmResponse.recommendations[0];
    itemId: string;
    match: Awaited<ReturnType<typeof searchByCategory>>[0];
    qualityScore: number;
  }

  const candidateResults = await Promise.allSettled(
    validatedSearches.map(async ({ rec, match }): Promise<ValidCandidate | null> => {
      // Upsert item
      const { data: existingItem } = await supabase
        .from('items')
        .select('id, metadata')
        .eq('external_id', match.external_id)
        .eq('external_source', match.external_source)
        .eq('category', match.category)
        .single();

      let itemId: string;
      let existingMetadata: Record<string, unknown> = {};

      if (existingItem) {
        itemId = existingItem.id;
        existingMetadata = (existingItem.metadata as Record<string, unknown>) || {};
      } else {
        const { data: newItem, error: insertError } = await supabase
          .from('items')
          .insert({
            category: match.category,
            external_id: match.external_id,
            external_source: match.external_source,
            title: match.title,
            creator: match.creator,
            description: match.description,
            genres: match.genres || [],
            year: match.year,
            image_url: match.image_url,
            metadata: {
              ...(match.metadata || {}),
              tmdb_rating: match.rating,
              tmdb_vote_count: match.vote_count,
            },
          })
          .select('id')
          .single();
        if (insertError || !newItem) return null;
        itemId = newItem.id;
      }

      // Check already rated + pending in parallel
      const [ratingCheck, pendingCheck] = await Promise.all([
        supabase
          .from('ratings')
          .select('id')
          .eq('user_id', user.id)
          .eq('item_id', itemId)
          .single(),
        supabase
          .from('recommendations')
          .select('id')
          .eq('user_id', user.id)
          .eq('item_id', itemId)
          .eq('status', 'pending')
          .single(),
      ]);

      if (ratingCheck.data) return null;
      if (pendingCheck.data) return null;

      // Fetch quality scores + watch providers
      let qualityScore = match.rating || 5;

      if (isTmdbCategory) {
        // Fetch OMDB scores + watch providers in parallel
        const tmdbType = category === 'tv_shows' ? 'tv' : 'movie';
        const tmdbId = parseInt(match.external_id);

        const [omdbResult, watchResult] = await Promise.allSettled([
          existingMetadata.imdb_rating
            ? Promise.resolve(null)
            : fetchOMDBByTitle(match.title, match.year),
          existingMetadata.watch_providers
            ? Promise.resolve(null)
            : getWatchProviders(tmdbId, tmdbType as 'movie' | 'tv', 'AU'),
        ]);

        if (existingMetadata.imdb_rating) {
          qualityScore = existingMetadata.imdb_rating as number;
        } else {
          const omdb = omdbResult.status === 'fulfilled' ? omdbResult.value : null;
          if (omdb) {
            const composite = computeQualityScore(omdb);
            if (composite) qualityScore = composite;
          }
        }

        // Build metadata update with OMDB + watch providers
        const metadataUpdate: Record<string, unknown> = { ...existingMetadata };
        let needsUpdate = false;

        const omdb = omdbResult.status === 'fulfilled' ? omdbResult.value : null;
        if (omdb && !existingMetadata.imdb_rating) {
          Object.assign(metadataUpdate, {
            tmdb_rating: match.rating,
            tmdb_vote_count: match.vote_count,
            imdb_rating: omdb.imdbRating,
            imdb_votes: omdb.imdbVotes,
            rotten_tomatoes: omdb.rottenTomatoes,
            metascore: omdb.metascore,
            imdb_id: omdb.imdbId,
          });
          needsUpdate = true;
        }

        const watchProviders = watchResult.status === 'fulfilled' ? watchResult.value : null;
        if (watchProviders && !existingMetadata.watch_providers) {
          metadataUpdate.watch_providers = watchProviders;
          metadataUpdate.watch_providers_updated_at = new Date().toISOString();
          needsUpdate = true;
        }

        if (needsUpdate) {
          supabase
            .from('items')
            .update({ metadata: metadataUpdate })
            .eq('id', itemId)
            .then(() => {});
        }
      } else if (category === 'fiction_books' || category === 'nonfiction_books') {
        qualityScore = match.rating || 0;
        if (existingMetadata.google_rating) {
          qualityScore = existingMetadata.google_rating as number;
        } else if (match.rating > 0) {
          supabase
            .from('items')
            .update({
              metadata: {
                ...existingMetadata,
                google_rating: match.rating,
                google_vote_count: match.vote_count,
              },
            })
            .eq('id', itemId)
            .then(() => {});
        }
      } else if (category === 'music_artists') {
        const popularity = (match.metadata as Record<string, unknown>)?.popularity as number || 0;
        qualityScore = popularity / 10;
        if (!existingMetadata.spotify_popularity && popularity > 0) {
          supabase
            .from('items')
            .update({
              metadata: {
                ...existingMetadata,
                spotify_popularity: popularity,
              },
            })
            .eq('id', itemId)
            .then(() => {});
        } else if (existingMetadata.spotify_popularity) {
          qualityScore = (existingMetadata.spotify_popularity as number) / 10;
        }
      } else if (category === 'podcasts') {
        qualityScore = 7;
      }

      return { rec, itemId, match, qualityScore };
    })
  );

  const candidates = candidateResults
    .filter((r): r is PromiseFulfilledResult<ValidCandidate | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((c): c is ValidCandidate => c !== null);

  // Log failures for debugging
  const searchFailures = searchResults.filter((r) => r.status === 'rejected');
  const candidateFailures = candidateResults.filter((r) => r.status === 'rejected');
  if (searchFailures.length > 0) {
    console.error(`[generate] ${searchFailures.length} search(es) failed:`, searchFailures.map((r) => (r as PromiseRejectedResult).reason?.message || r));
  }
  if (candidateFailures.length > 0) {
    console.error(`[generate] ${candidateFailures.length} candidate(s) failed:`, candidateFailures.map((r) => (r as PromiseRejectedResult).reason?.message || r));
  }
  console.log(`[generate] ${validatedSearches.length} validated searches → ${candidates.length} candidates`);

  // Step 4: Sort by quality score and take top 5, insert in parallel
  candidates.sort((a, b) => b.qualityScore - a.qualityScore);

  const top3 = candidates.slice(0, 5);
  const insertResults = await Promise.all(
    top3.map(async ({ rec, itemId, qualityScore }) => {
      const { data: recommendation } = await supabase
        .from('recommendations')
        .insert({
          user_id: user.id,
          item_id: itemId,
          status: 'pending',
          reason: rec.reason,
          model_used: llmResponse.model,
          batch_id: batchId,
          intent: intent || refinement || null,
          confidence: rec.confidence,
        })
        .select('*, item:items(*)')
        .single();

      if (recommendation) {
        return {
          ...recommendation,
          confidence: rec.confidence,
          qualityScore,
        };
      }
      return null;
    })
  );

  const results = insertResults.filter(Boolean);

  // --- Save session + increment count in parallel ---
  const assistantMessage = JSON.stringify(llmResponse.recommendations);
  const newMessages = [
    ...conversationHistory,
    { role: 'user', content: refinement || intent || `Recommend ${category}` },
    { role: 'assistant', content: assistantMessage },
  ];

  let currentSessionId = sessionId;

  await Promise.all([
    sessionId
      ? supabase
          .from('conversation_sessions')
          .update({ messages: newMessages })
          .eq('id', sessionId)
      : supabase
          .from('conversation_sessions')
          .insert({
            user_id: user.id,
            category,
            intent: intent || null,
            genre: genre || null,
            messages: newMessages,
            batch_ids: [batchId],
          })
          .select('id')
          .single()
          .then(({ data }) => {
            if (data) currentSessionId = data.id;
          }),
    supabase
      .from('users')
      .update({ monthly_request_count: profile.monthly_request_count + 1 })
      .eq('id', user.id),
  ]);

  return NextResponse.json({
    recommendations: results,
    batchId,
    sessionId: currentSessionId,
    requestsUsed: profile.monthly_request_count + 1,
    requestsLimit: profile.monthly_request_limit,
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Generate route error:', message);
    return NextResponse.json({ error: `Recommendation error: ${message}` }, { status: 500 });
  }
}
