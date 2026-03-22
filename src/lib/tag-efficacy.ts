import { SupabaseClient } from '@supabase/supabase-js';

export interface TagEfficacyScore {
  tag: string;
  dimension: string; // sub_genres, themes, tone, special_tags, etc.
  ratingVariance: number; // higher = more polarising = more useful
  avgRatingWhenPresent: number;
  timesRated: number; // how many rated items have this tag
  userCount: number; // how many different users have rated items with this tag
  efficacyScore: number; // composite: variance × log(timesRated)
}

export interface TagEfficacyReport {
  category: string;
  computedAt: string;
  totalItemsAnalysed: number;
  totalRatingsAnalysed: number;
  topSignalTags: TagEfficacyScore[];
  lowSignalTags: TagEfficacyScore[];
  dimensionRanking: { dimension: string; avgEfficacy: number }[];
}

// Compute tag efficacy for a category based on actual user ratings
export async function computeTagEfficacy(
  supabase: SupabaseClient,
  category: string
): Promise<TagEfficacyReport> {
  // Map category to DB values
  const categories = category === 'books'
    ? ['books', 'fiction_books', 'nonfiction_books']
    : category === 'movies'
      ? ['movies', 'documentaries']
      : [category];

  // Get all ratings with enriched items in this category
  const { data: ratings } = await supabase
    .from('ratings')
    .select('score, user_id, item:items!inner(id, category, metadata)')
    .in('items.category', categories);

  if (!ratings || ratings.length === 0) {
    return {
      category,
      computedAt: new Date().toISOString(),
      totalItemsAnalysed: 0,
      totalRatingsAnalysed: 0,
      topSignalTags: [],
      lowSignalTags: [],
      dimensionRanking: [],
    };
  }

  // Extract tag → rating mappings
  const tagRatings: Record<string, Record<string, { scores: number[]; users: Set<string> }>> = {};
  // tagRatings[dimension][tagValue] = { scores: [...], users: Set }

  const dimensions = ['sub_genres', 'themes', 'tone', 'special_tags', 'content_warnings'];
  const scalarDimensions = ['pacing', 'complexity', 'audience', 'popularity_tier'];

  let itemsAnalysed = 0;

  for (const rating of ratings) {
    const item = rating.item as unknown as { metadata: Record<string, unknown> | null };
    const tags = item?.metadata?.tags as Record<string, unknown> | undefined;
    if (!tags) continue;

    itemsAnalysed++;

    // Array dimensions
    for (const dim of dimensions) {
      const values = tags[dim] as string[] | undefined;
      if (!values || !Array.isArray(values)) continue;

      if (!tagRatings[dim]) tagRatings[dim] = {};

      for (const val of values) {
        if (!tagRatings[dim][val]) tagRatings[dim][val] = { scores: [], users: new Set() };
        tagRatings[dim][val].scores.push(rating.score);
        tagRatings[dim][val].users.add(rating.user_id);
      }
    }

    // Scalar dimensions
    for (const dim of scalarDimensions) {
      const val = tags[dim] as string | undefined;
      if (!val) continue;

      if (!tagRatings[dim]) tagRatings[dim] = {};
      if (!tagRatings[dim][val]) tagRatings[dim][val] = { scores: [], users: new Set() };
      tagRatings[dim][val].scores.push(rating.score);
      tagRatings[dim][val].users.add(rating.user_id);
    }
  }

  // Compute efficacy scores
  const allScores: TagEfficacyScore[] = [];

  for (const [dimension, tags] of Object.entries(tagRatings)) {
    for (const [tag, data] of Object.entries(tags)) {
      if (data.scores.length < 3) continue; // Need minimum data

      const mean = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const variance = data.scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / data.scores.length;

      // Efficacy = variance × log(sample size)
      // High variance + high sample size = highly informative tag
      const efficacy = variance * Math.log(data.scores.length + 1);

      allScores.push({
        tag,
        dimension,
        ratingVariance: Math.round(variance * 100) / 100,
        avgRatingWhenPresent: Math.round(mean * 10) / 10,
        timesRated: data.scores.length,
        userCount: data.users.size,
        efficacyScore: Math.round(efficacy * 100) / 100,
      });
    }
  }

  // Sort by efficacy
  allScores.sort((a, b) => b.efficacyScore - a.efficacyScore);

  // Compute dimension-level ranking
  const dimensionScores: Record<string, number[]> = {};
  for (const score of allScores) {
    if (!dimensionScores[score.dimension]) dimensionScores[score.dimension] = [];
    dimensionScores[score.dimension].push(score.efficacyScore);
  }

  const dimensionRanking = Object.entries(dimensionScores)
    .map(([dimension, scores]) => ({
      dimension,
      avgEfficacy: Math.round(
        (scores.reduce((a, b) => a + b, 0) / scores.length) * 100
      ) / 100,
    }))
    .sort((a, b) => b.avgEfficacy - a.avgEfficacy);

  return {
    category,
    computedAt: new Date().toISOString(),
    totalItemsAnalysed: itemsAnalysed,
    totalRatingsAnalysed: ratings.length,
    topSignalTags: allScores.slice(0, 20),
    lowSignalTags: allScores.slice(-10),
    dimensionRanking,
  };
}

// Compute per-user tag weights based on how predictive each tag is for THEIR ratings
export async function computeUserTagWeights(
  supabase: SupabaseClient,
  userId: string,
  category: string
): Promise<Record<string, Record<string, number>> | null> {
  const categories = category === 'books'
    ? ['books', 'fiction_books', 'nonfiction_books']
    : category === 'movies'
      ? ['movies', 'documentaries']
      : [category];

  const { data: ratings } = await supabase
    .from('ratings')
    .select('score, item:items!inner(metadata, category)')
    .eq('user_id', userId)
    .in('items.category', categories);

  if (!ratings || ratings.length < 10) return null;

  // For each tag, compute: avg rating when tag is present vs absent
  const tagScores: Record<string, Record<string, { present: number[]; }>> = {};
  const dimensions = ['sub_genres', 'themes', 'tone', 'special_tags', 'pacing', 'complexity'];

  for (const rating of ratings) {
    const item = rating.item as unknown as { metadata: Record<string, unknown> | null };
    const tags = item?.metadata?.tags as Record<string, unknown> | undefined;
    if (!tags) continue;

    for (const dim of dimensions) {
      if (!tagScores[dim]) tagScores[dim] = {};

      const values = tags[dim];
      const tagValues = Array.isArray(values) ? values : (typeof values === 'string' ? [values] : []);

      for (const val of tagValues) {
        if (!tagScores[dim][val as string]) tagScores[dim][val as string] = { present: [] };
        tagScores[dim][val as string].present.push(rating.score);
      }
    }
  }

  // Compute weights: how much does this tag correlate with high/low ratings for this user
  const weights: Record<string, Record<string, number>> = {};
  const overallMean = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

  for (const [dim, tags] of Object.entries(tagScores)) {
    weights[dim] = {};
    for (const [tag, data] of Object.entries(tags)) {
      if (data.present.length < 2) continue;

      const tagMean = data.present.reduce((a, b) => a + b, 0) / data.present.length;
      // Weight = deviation from overall mean, scaled by sample size confidence
      const confidence = Math.min(data.present.length / 10, 1); // 0-1 based on sample size
      const weight = (tagMean - overallMean) * confidence;

      weights[dim][tag] = Math.round(weight * 100) / 100;
    }
  }

  return weights;
}

// Format user tag weights for the LLM prompt
export function formatUserTagWeights(
  weights: Record<string, Record<string, number>>
): string | null {
  const boosts: string[] = [];
  const suppresses: string[] = [];

  for (const [, tags] of Object.entries(weights)) {
    for (const [tag, weight] of Object.entries(tags)) {
      if (weight >= 0.5) boosts.push(`${tag} (+${weight})`);
      else if (weight <= -0.5) suppresses.push(`${tag} (${weight})`);
    }
  }

  if (boosts.length === 0 && suppresses.length === 0) return null;

  const lines = ['PERSONALISED TAG WEIGHTS (data-driven from this user\'s rating patterns):'];
  if (boosts.length > 0) {
    lines.push(`- Boost: ${boosts.slice(0, 10).join(', ')}`);
  }
  if (suppresses.length > 0) {
    lines.push(`- Suppress: ${suppresses.slice(0, 10).join(', ')}`);
  }
  lines.push('Use these weights to fine-tune recommendations — boosted tags should be prioritised, suppressed tags should be avoided.');

  return lines.join('\n');
}
