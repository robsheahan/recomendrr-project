import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildTasteProfile } from '@/lib/taste-profile';
import { generateRecommendations } from '@/lib/llm';
import { searchByCategory } from '@/lib/tmdb';
import { FREE_TIER_MONTHLY_LIMIT, COOLDOWN_DAYS, MAX_RECOMMENDATION_COUNT } from '@/lib/constants';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = await request.json();

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

  // Check quota for free tier
  if (
    profile.tier === 'free' &&
    profile.monthly_request_count >= (profile.monthly_request_limit ?? FREE_TIER_MONTHLY_LIMIT)
  ) {
    return NextResponse.json(
      { error: 'Monthly recommendation limit reached. Upgrade to paid for unlimited.' },
      { status: 429 }
    );
  }

  // Get user's ratings with item details
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

  // Transform ratings to include item data
  const ratingsWithItems = ratings.map((r) => ({
    ...r,
    item: r.item,
  }));

  // Get "not interested" items
  const { data: notInterestedRecs } = await supabase
    .from('recommendations')
    .select('item:items(title)')
    .eq('user_id', user.id)
    .eq('status', 'not_interested');

  const notInterestedTitles = (notInterestedRecs || [])
    .map((r) => (r.item as unknown as { title: string })?.title)
    .filter(Boolean);

  // Get previously recommended items (in cooldown)
  const { data: cooldowns } = await supabase
    .from('recommendation_cooldowns')
    .select('item:items(title)')
    .eq('user_id', user.id);

  const previouslyRecommendedTitles = (cooldowns || [])
    .map((c) => (c.item as unknown as { title: string })?.title)
    .filter(Boolean);

  // Also get all rated item titles to exclude
  const ratedTitles = ratingsWithItems
    .filter((r) => r.item?.category === category)
    .map((r) => r.item?.title)
    .filter(Boolean);

  const allExcluded = [
    ...new Set([...previouslyRecommendedTitles, ...ratedTitles]),
  ];

  // Build taste profile
  const tasteProfile = buildTasteProfile(
    ratingsWithItems,
    notInterestedTitles,
    allExcluded,
    category
  );

  // Generate recommendations via LLM
  let llmResponse;
  try {
    llmResponse = await generateRecommendations(tasteProfile, profile.tier);
  } catch (err) {
    console.error('LLM error:', err);
    return NextResponse.json(
      { error: 'Failed to generate recommendations. Please try again.' },
      { status: 500 }
    );
  }

  // Process each recommendation: search TMDB, create items, store recommendations
  const batchId = crypto.randomUUID();
  const results = [];

  for (const rec of llmResponse.recommendations) {
    try {
      // Search for the item on TMDB to get metadata
      const searchResults = await searchByCategory(category, rec.title);
      const match = searchResults.find(
        (s) =>
          s.title.toLowerCase() === rec.title.toLowerCase() ||
          s.title.toLowerCase().includes(rec.title.toLowerCase())
      ) || searchResults[0];

      if (!match) {
        // LLM hallucinated an item — skip it
        continue;
      }

      // Upsert item
      const { data: existingItem } = await supabase
        .from('items')
        .select('id')
        .eq('external_id', match.external_id)
        .eq('external_source', match.external_source)
        .eq('category', match.category)
        .single();

      let itemId: string;

      if (existingItem) {
        itemId = existingItem.id;
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
            metadata: match.metadata || null,
          })
          .select('id')
          .single();

        if (insertError || !newItem) continue;
        itemId = newItem.id;
      }

      // Check cooldown
      const { data: cooldown } = await supabase
        .from('recommendation_cooldowns')
        .select('*')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .single();

      if (cooldown) {
        const lastRecommended = new Date(cooldown.last_recommended_at);
        const daysSince = (Date.now() - lastRecommended.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < COOLDOWN_DAYS || cooldown.times_recommended >= MAX_RECOMMENDATION_COUNT) {
          continue; // Skip items in cooldown
        }
      }

      // Store recommendation
      const { data: recommendation } = await supabase
        .from('recommendations')
        .insert({
          user_id: user.id,
          item_id: itemId,
          status: 'pending',
          reason: rec.reason,
          model_used: llmResponse.model,
          batch_id: batchId,
        })
        .select('*, item:items(*)')
        .single();

      // Upsert cooldown
      if (cooldown) {
        await supabase
          .from('recommendation_cooldowns')
          .update({
            last_recommended_at: new Date().toISOString(),
            times_recommended: cooldown.times_recommended + 1,
          })
          .eq('id', cooldown.id);
      } else {
        await supabase
          .from('recommendation_cooldowns')
          .insert({
            user_id: user.id,
            item_id: itemId,
          });
      }

      if (recommendation) {
        results.push({
          ...recommendation,
          confidence: rec.confidence,
        });
      }
    } catch (err) {
      console.error('Error processing recommendation:', err);
      continue;
    }
  }

  // Increment monthly request count
  await supabase
    .from('users')
    .update({
      monthly_request_count: profile.monthly_request_count + 1,
    })
    .eq('id', user.id);

  return NextResponse.json({
    recommendations: results,
    batchId,
    requestsUsed: profile.monthly_request_count + 1,
    requestsLimit: profile.monthly_request_limit,
  });
}
