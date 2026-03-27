import { SupabaseClient } from '@supabase/supabase-js';

// --- Taste Similarity ---

// Compute cosine similarity between two users based on shared item ratings
export function computeSimilarity(
  ratingsA: Map<string, number>,
  ratingsB: Map<string, number>
): { score: number; sharedItems: number } {
  // Find shared items
  const shared: string[] = [];
  for (const itemId of ratingsA.keys()) {
    if (ratingsB.has(itemId)) shared.push(itemId);
  }

  if (shared.length < 3) {
    return { score: 0, sharedItems: shared.length };
  }

  // Compute cosine similarity on shared items
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const itemId of shared) {
    const a = ratingsA.get(itemId)!;
    const b = ratingsB.get(itemId)!;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  const score = denominator > 0 ? dotProduct / denominator : 0;

  return { score: Math.round(score * 1000) / 1000, sharedItems: shared.length };
}

// Compute similarity between target user and all other users
export async function computeAllSimilarities(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  // Get target user's ratings
  const { data: userRatings } = await supabase
    .from('ratings')
    .select('item_id, score')
    .eq('user_id', userId);

  if (!userRatings || userRatings.length < 5) return;

  const userRatingsMap = new Map<string, number>();
  for (const r of userRatings) userRatingsMap.set(r.item_id, r.score);

  // Get all other users who have ratings
  const { data: otherUsers } = await supabase
    .from('users')
    .select('id')
    .neq('id', userId);

  if (!otherUsers) return;

  for (const otherUser of otherUsers) {
    const { data: otherRatings } = await supabase
      .from('ratings')
      .select('item_id, score')
      .eq('user_id', otherUser.id);

    if (!otherRatings || otherRatings.length < 5) continue;

    const otherRatingsMap = new Map<string, number>();
    for (const r of otherRatings) otherRatingsMap.set(r.item_id, r.score);

    const { score, sharedItems } = computeSimilarity(userRatingsMap, otherRatingsMap);

    if (sharedItems < 3 || score < 0.5) continue;

    // Sort user IDs to ensure consistent ordering
    const [userA, userB] = [userId, otherUser.id].sort();

    await supabase
      .from('taste_similarity')
      .upsert(
        {
          user_a: userA,
          user_b: userB,
          similarity_score: score,
          shared_items: sharedItems,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'user_a,user_b' }
      );
  }
}

// --- Collaborative Signals ---

// Find items that similar users loved but the target user hasn't seen
export async function computeCollaborativeSignals(
  supabase: SupabaseClient,
  userId: string,
  category: string,
  limit: number = 20
): Promise<{
  title: string;
  itemId: string;
  sourceUserCount: number;
  avgSimilarity: number;
  avgRating: number;
  signalStrength: number;
}[]> {
  // Get similar users (similarity > 0.6)
  const { data: similarities } = await supabase
    .from('taste_similarity')
    .select('user_a, user_b, similarity_score')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .gte('similarity_score', 0.6)
    .order('similarity_score', { ascending: false })
    .limit(50);

  if (!similarities || similarities.length === 0) return [];

  // Get similar user IDs
  const similarUsers = similarities.map((s) => ({
    userId: s.user_a === userId ? s.user_b : s.user_a,
    similarity: s.similarity_score,
  }));

  // Get target user's rated items to exclude
  const { data: userRatings } = await supabase
    .from('ratings')
    .select('item_id')
    .eq('user_id', userId);

  const ratedItemIds = new Set((userRatings || []).map((r) => r.item_id));

  // Get highly-rated items from similar users in this category
  const itemSignals = new Map<string, {
    title: string;
    scores: number[];
    similarities: number[];
  }>();

  for (const su of similarUsers) {
    const { data: theirRatings } = await supabase
      .from('ratings')
      .select('item_id, score, item:items(title, category)')
      .eq('user_id', su.userId)
      .gte('score', 4); // Only items they loved

    if (!theirRatings) continue;

    for (const r of theirRatings) {
      const item = r.item as unknown as { title: string; category: string };
      if (!item || item.category !== category) continue;
      if (ratedItemIds.has(r.item_id)) continue;

      if (!itemSignals.has(r.item_id)) {
        itemSignals.set(r.item_id, {
          title: item.title,
          scores: [],
          similarities: [],
        });
      }

      const signal = itemSignals.get(r.item_id)!;
      signal.scores.push(r.score);
      signal.similarities.push(su.similarity);
    }
  }

  // Compute signal strength and sort
  const results = Array.from(itemSignals.entries())
    .map(([itemId, signal]) => {
      const avgRating = signal.scores.reduce((a, b) => a + b, 0) / signal.scores.length;
      const avgSimilarity = signal.similarities.reduce((a, b) => a + b, 0) / signal.similarities.length;
      // Signal strength: weighted by number of similar users, their similarity, and their ratings
      const signalStrength = signal.scores.length * avgSimilarity * (avgRating / 5);

      return {
        title: signal.title,
        itemId,
        sourceUserCount: signal.scores.length,
        avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
        avgRating: Math.round(avgRating * 10) / 10,
        signalStrength: Math.round(signalStrength * 1000) / 1000,
      };
    })
    .sort((a, b) => b.signalStrength - a.signalStrength)
    .slice(0, limit);

  // Cache the signals
  for (const r of results) {
    await supabase
      .from('collaborative_signals')
      .upsert(
        {
          target_user_id: userId,
          item_id: r.itemId,
          source_user_count: r.sourceUserCount,
          avg_similarity: r.avgSimilarity,
          avg_rating: r.avgRating,
          signal_strength: r.signalStrength,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'target_user_id,item_id' }
      );
  }

  return results;
}

// --- Item Reputation ---

export async function updateItemReputation(
  supabase: SupabaseClient,
  itemId: string
): Promise<void> {
  // Count recommendations and feedback for this item across all users
  const { data: recs } = await supabase
    .from('recommendations')
    .select('feedback, post_rating')
    .eq('item_id', itemId);

  if (!recs || recs.length === 0) return;

  const thumbsUp = recs.filter((r) => r.feedback === 'good').length;
  const thumbsDown = recs.filter((r) => r.feedback === 'bad').length;
  const postRatings = recs.filter((r) => r.post_rating != null).map((r) => r.post_rating!);
  const avgPostRating = postRatings.length > 0
    ? postRatings.reduce((a, b) => a + b, 0) / postRatings.length
    : null;

  // Get all user ratings for this item
  const { data: ratings } = await supabase
    .from('ratings')
    .select('score')
    .eq('item_id', itemId);

  const totalRatings = ratings?.length || 0;
  const avgUserRating = totalRatings > 0
    ? ratings!.reduce((a, r) => a + r.score, 0) / totalRatings
    : null;

  const totalFeedback = thumbsUp + thumbsDown;
  const hitRate = totalFeedback > 0 ? thumbsUp / totalFeedback : null;

  await supabase
    .from('item_reputation')
    .upsert(
      {
        item_id: itemId,
        times_recommended: recs.length,
        thumbs_up: thumbsUp,
        thumbs_down: thumbsDown,
        avg_post_rating: avgPostRating ? Math.round(avgPostRating * 10) / 10 : null,
        total_ratings: totalRatings,
        avg_user_rating: avgUserRating ? Math.round(avgUserRating * 10) / 10 : null,
        hit_rate: hitRate ? Math.round(hitRate * 100) / 100 : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'item_id' }
    );
}

// --- Cached Collaborative Signals ---

// Read pre-computed signals from the cache table instead of recomputing on every request
export async function getCachedCollaborativeSignals(
  supabase: SupabaseClient,
  userId: string,
  category: string,
  limit: number = 10
): Promise<{
  title: string;
  itemId: string;
  sourceUserCount: number;
  avgSimilarity: number;
  avgRating: number;
  signalStrength: number;
}[]> {
  const { data: signals } = await supabase
    .from('collaborative_signals')
    .select('item_id, source_user_count, avg_similarity, avg_rating, signal_strength, item:items(title, category)')
    .eq('target_user_id', userId)
    .order('signal_strength', { ascending: false })
    .limit(limit * 2); // Fetch extra to filter by category

  if (!signals || signals.length === 0) return [];

  return signals
    .filter((s) => {
      const item = s.item as unknown as { category: string };
      return item?.category === category;
    })
    .slice(0, limit)
    .map((s) => ({
      title: (s.item as unknown as { title: string })?.title || '',
      itemId: s.item_id,
      sourceUserCount: s.source_user_count,
      avgSimilarity: s.avg_similarity,
      avgRating: s.avg_rating,
      signalStrength: s.signal_strength,
    }));
}

// --- Format for LLM Prompt ---

export function formatCollaborativeSignals(
  signals: { title: string; sourceUserCount: number; avgRating: number; signalStrength: number }[]
): string | null {
  if (signals.length === 0) return null;

  const lines = ['COLLABORATIVE SIGNALS (items loved by users with similar taste to yours):'];
  for (const s of signals.slice(0, 5)) {
    lines.push(
      `- ${s.title} — ${s.sourceUserCount} similar user${s.sourceUserCount > 1 ? 's' : ''} rated this ${s.avgRating}/5`
    );
  }
  lines.push('Consider prioritising these items if they match the user\'s current intent.');

  return lines.join('\n');
}
