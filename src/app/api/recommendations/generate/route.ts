import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildTasteProfile } from '@/lib/taste-profile';
import { generateRecommendations, generateRefinement } from '@/lib/llm';
import { searchByCategory } from '@/lib/tmdb';
import { COOLDOWN_DAYS, MAX_RECOMMENDATION_COUNT } from '@/lib/constants';
import {
  computeRatingDistribution,
  shouldRegenerateFingerprint,
  generateTasteFingerprint,
  generateMissAnalysis,
} from '@/lib/taste-fingerprint';
import {
  computeCollaborativeSignals,
  computeAllSimilarities,
  formatCollaborativeSignals,
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

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('tier, monthly_request_count, monthly_request_limit')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get ALL ratings with item details (cross-media)
  const { data: ratings } = await supabase
    .from('ratings')
    .select('*, item:items(*)')
    .eq('user_id', user.id);

  if (!ratings || ratings.length === 0) {
    return NextResponse.json(
      { error: 'Rate some items first to get recommendations' },
      { status: 400 }
    );
  }

  const ratingsWithItems = ratings.map((r) => ({ ...r, item: r.item }));

  // Compute rating distribution
  const distribution = computeRatingDistribution(ratingsWithItems);

  // --- Fingerprint with staleness check ---
  const { data: fingerprintRecord } = await supabase
    .from('taste_fingerprints')
    .select('*')
    .eq('user_id', user.id)
    .is('category', null)
    .single();

  let fingerprint = fingerprintRecord?.fingerprint || null;
  let tasteThesis = fingerprintRecord?.taste_thesis || null;
  let evolutionNotes = fingerprintRecord?.evolution_notes || null;
  let crossCategoryPatterns = fingerprintRecord?.cross_category_patterns || null;
  let missAnalysis = fingerprintRecord?.miss_analysis || null;

  // Count bad feedback since last fingerprint generation
  const ratingsAtGen = fingerprintRecord?.ratings_count_at_generation || 0;
  const { count: badFeedbackCount } = await supabase
    .from('recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('feedback', 'bad')
    .gt('created_at', fingerprintRecord?.generated_at || '2000-01-01');

  const needsRegen = !fingerprint || shouldRegenerateFingerprint(
    ratings.length,
    ratingsAtGen,
    badFeedbackCount || 0
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
        .select('fingerprint, ratings_count_at_generation')
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
          tasteThesis
        );

        if (result) {
          catFingerprint = result;
          const upsertData = {
            user_id: user.id,
            category,
            fingerprint: result,
            generated_at: new Date().toISOString(),
            ratings_count_at_generation: categoryRatings.length,
            fingerprint_version: (catFpRecord?.ratings_count_at_generation ? 2 : 1),
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

  // --- Confidence calibration ---
  let calibration: { high: number | null; medium: number | null; low: number | null; total: number } | null = null;

  const { data: feedbackRecs } = await supabase
    .from('recommendations')
    .select('confidence, feedback')
    .eq('user_id', user.id)
    .not('feedback', 'is', null)
    .not('confidence', 'is', null);

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

  // --- Collaborative signals ---
  let collaborativeSection: string | null = null;
  try {
    // Recompute similarities if fingerprint was regenerated
    if (needsRegen) {
      await computeAllSimilarities(supabase, user.id);
    }
    const signals = await computeCollaborativeSignals(supabase, user.id, category, 10);
    collaborativeSection = formatCollaborativeSignals(signals);
  } catch (err) {
    console.error('Collaborative signals error:', err);
    // Non-blocking — continue without collaborative data
  }

  // --- Exclusion lists ---
  const { data: notInterestedRecs } = await supabase
    .from('recommendations')
    .select('item:items(title)')
    .eq('user_id', user.id)
    .eq('status', 'not_interested');

  const notInterestedTitles = (notInterestedRecs || [])
    .map((r) => (r.item as unknown as { title: string })?.title)
    .filter(Boolean);

  const { data: cooldowns } = await supabase
    .from('recommendation_cooldowns')
    .select('item:items(title)')
    .eq('user_id', user.id);

  const previouslyRecommendedTitles = (cooldowns || [])
    .map((c) => (c.item as unknown as { title: string })?.title)
    .filter(Boolean);

  const ratedTitles = ratingsWithItems
    .filter((r) => r.item?.category === category)
    .map((r) => r.item?.title)
    .filter(Boolean);

  const allExcluded = [...new Set([...previouslyRecommendedTitles, ...ratedTitles])];

  // --- Conversation history ---
  let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  if (sessionId) {
    const { data: session } = await supabase
      .from('conversation_sessions')
      .select('messages')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();
    if (session?.messages) {
      conversationHistory = session.messages as { role: 'user' | 'assistant'; content: string }[];
    }
  }

  // --- Compute user tag weights ---
  let userTagWeights: Record<string, Record<string, number>> | null = null;
  try {
    userTagWeights = await computeUserTagWeights(supabase, user.id, category);
  } catch {
    // Non-blocking
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

  // --- Process recommendations ---
  const batchId = crypto.randomUUID();
  const usedTitles = new Set<string>();
  const usedExternalIds = new Set<string>();
  const isTmdbCategory = ['movies', 'tv_shows', 'documentaries'].includes(category);

  // Get recently recommended item titles (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: allPrevRecs } = await supabase
    .from('recommendations')
    .select('item:items(title, external_id, category)')
    .eq('user_id', user.id)
    .gt('created_at', thirtyDaysAgo);

  const prevRecTitles = new Set(
    (allPrevRecs || [])
      .filter((r) => {
        const item = r.item as unknown as { category: string };
        return item?.category === category;
      })
      .map((r) => (r.item as unknown as { title: string })?.title?.toLowerCase())
      .filter(Boolean)
  );

  // Step 1: Validate all candidates and fetch quality scores
  interface ValidCandidate {
    rec: typeof llmResponse.recommendations[0];
    itemId: string;
    match: Awaited<ReturnType<typeof searchByCategory>>[0];
    qualityScore: number;
  }

  const candidates: ValidCandidate[] = [];

  for (const rec of llmResponse.recommendations) {
    try {
      if (usedTitles.has(rec.title.toLowerCase())) continue;
      if (prevRecTitles.has(rec.title.toLowerCase())) continue;

      const searchResults = await searchByCategory(category, rec.title);
      const recTitle = rec.title.toLowerCase();
      const match =
        searchResults.find((s) => s.title.toLowerCase() === recTitle) ||
        searchResults.find((s) => s.title.toLowerCase().includes(recTitle)) ||
        searchResults.find((s) => recTitle.includes(s.title.toLowerCase())) ||
        searchResults[0];

      if (!match) continue;
      if (usedExternalIds.has(match.external_id)) continue;

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
        if (insertError || !newItem) continue;
        itemId = newItem.id;
      }

      // Skip already rated
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .single();

      if (existingRating) continue;

      // Skip pending duplicates
      const { data: recentRec } = await supabase
        .from('recommendations')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .eq('status', 'pending')
        .single();

      if (recentRec) continue;

      // Fetch quality scores based on category
      let qualityScore = match.rating || 5;

      if (isTmdbCategory) {
        // Movies/TV/Docs: use OMDB for IMDB + RT scores
        if (existingMetadata.imdb_rating) {
          qualityScore = existingMetadata.imdb_rating as number;
        } else {
          try {
            const omdb = await fetchOMDBByTitle(match.title, match.year);
            if (omdb) {
              const composite = computeQualityScore(omdb);
              if (composite) qualityScore = composite;

              await supabase
                .from('items')
                .update({
                  metadata: {
                    ...existingMetadata,
                    tmdb_rating: match.rating,
                    tmdb_vote_count: match.vote_count,
                    imdb_rating: omdb.imdbRating,
                    imdb_votes: omdb.imdbVotes,
                    rotten_tomatoes: omdb.rottenTomatoes,
                    metascore: omdb.metascore,
                    imdb_id: omdb.imdbId,
                  },
                })
                .eq('id', itemId);
            }
          } catch {
            // OMDB fetch failed, continue with TMDB rating
          }
        }
      } else if (category === 'fiction_books' || category === 'nonfiction_books') {
        // Books: use Google Books averageRating (already in match.rating)
        qualityScore = match.rating || 0;
        // Also check cached metadata
        if (existingMetadata.google_rating) {
          qualityScore = existingMetadata.google_rating as number;
        } else if (match.rating > 0) {
          await supabase
            .from('items')
            .update({
              metadata: {
                ...existingMetadata,
                google_rating: match.rating,
                google_vote_count: match.vote_count,
              },
            })
            .eq('id', itemId);
        }
      } else if (category === 'music_artists') {
        // Music: use Spotify popularity (0-100, convert to 0-10)
        const popularity = (match.metadata as Record<string, unknown>)?.popularity as number || 0;
        qualityScore = popularity / 10;
        if (!existingMetadata.spotify_popularity && popularity > 0) {
          await supabase
            .from('items')
            .update({
              metadata: {
                ...existingMetadata,
                spotify_popularity: popularity,
              },
            })
            .eq('id', itemId);
        } else if (existingMetadata.spotify_popularity) {
          qualityScore = (existingMetadata.spotify_popularity as number) / 10;
        }
      } else if (category === 'podcasts') {
        // Podcasts: no reliable quality signal, default score
        qualityScore = 7; // Neutral — let LLM ordering decide
      }

      candidates.push({ rec, itemId, match, qualityScore });
      usedTitles.add(match.title.toLowerCase());
      usedExternalIds.add(match.external_id);
    } catch (err) {
      console.error('Error processing recommendation:', err);
      continue;
    }
  }

  // Step 2: Sort by quality score (highest rated first) and take top 3
  candidates.sort((a, b) => b.qualityScore - a.qualityScore);

  const results = [];
  for (const candidate of candidates.slice(0, 3)) {
    const { rec, itemId, match, qualityScore } = candidate;

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
      results.push({
        ...recommendation,
        confidence: rec.confidence,
        qualityScore,
      });
    }
  }

  // Save conversation session
  const assistantMessage = JSON.stringify(llmResponse.recommendations);
  const newMessages = [
    ...conversationHistory,
    { role: 'user', content: refinement || intent || `Recommend ${category}` },
    { role: 'assistant', content: assistantMessage },
  ];

  let currentSessionId = sessionId;
  if (sessionId) {
    await supabase
      .from('conversation_sessions')
      .update({ messages: newMessages })
      .eq('id', sessionId);
  } else {
    const { data: newSession } = await supabase
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
      .single();
    currentSessionId = newSession?.id;
  }

  // Increment monthly request count
  await supabase
    .from('users')
    .update({ monthly_request_count: profile.monthly_request_count + 1 })
    .eq('id', user.id);

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
