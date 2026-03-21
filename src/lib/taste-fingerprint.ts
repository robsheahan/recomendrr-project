import { Item, Rating } from '@/types/database';

export interface TasteFingerprint {
  narrative_complexity: 'low' | 'medium' | 'high';
  preferred_pacing: 'fast' | 'medium' | 'slow_to_medium' | 'slow';
  moral_ambiguity_tolerance: 'low' | 'medium' | 'high';
  visual_importance: 'low' | 'medium' | 'high';
  humor_styles: string[];
  emotional_register: string[];
  theme_affinities: string[];
  dealbreakers: string[];
  openness_to_foreign_language: 'low' | 'medium' | 'high';
  era_preference: string;
  preference_orientation: 'discovery' | 'reliability' | 'balanced';
  summary: string;
}

export interface RatingDistribution {
  total_ratings: number;
  by_score: Record<number, number>;
  mean: number;
  std_dev: number;
  decisiveness: 'high' | 'moderate' | 'low';
  generosity: 'generous' | 'neutral' | 'critical';
  five_star_rate: number;
  category_counts: Record<string, number>;
}

export interface MissAnalysis {
  pattern_misses: string[];
  one_off_misses: string[];
  intent_misses: string[];
}

// --- Rating Distribution ---

export function computeRatingDistribution(
  ratings: (Rating & { item: Item })[]
): RatingDistribution {
  const scores = ratings.map((r) => r.score);
  const total = scores.length;

  const byScore: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of scores) byScore[s] = (byScore[s] || 0) + 1;

  const mean = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;
  const variance =
    total > 0
      ? scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / total
      : 0;
  const std_dev = Math.sqrt(variance);

  const fiveStarRate = total > 0 ? byScore[5] / total : 0;

  const categoryCounts: Record<string, number> = {};
  for (const r of ratings) {
    const cat = r.item.category;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  return {
    total_ratings: total,
    by_score: byScore,
    mean: Math.round(mean * 10) / 10,
    std_dev: Math.round(std_dev * 10) / 10,
    decisiveness: std_dev > 1.2 ? 'high' : std_dev > 0.7 ? 'moderate' : 'low',
    generosity: mean > 3.8 ? 'generous' : mean < 2.8 ? 'critical' : 'neutral',
    five_star_rate: Math.round(fiveStarRate * 100),
    category_counts: categoryCounts,
  };
}

// --- Genre Averages ---

export function computeGenreAverages(
  ratings: (Rating & { item: Item })[],
  category: string
): { genre: string; avg: number; count: number }[] {
  const genreScores: Record<string, number[]> = {};
  for (const r of ratings) {
    if (r.item.category !== category) continue;
    for (const g of r.item.genres) {
      if (!genreScores[g]) genreScores[g] = [];
      genreScores[g].push(r.score);
    }
  }

  return Object.entries(genreScores)
    .map(([genre, scores]) => ({
      genre,
      avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg);
}

// --- Fingerprint Generation ---

const FINGERPRINT_PROMPT = `You are a taste analyst. Given a user's media ratings, extract their taste fingerprint — the underlying preferences that explain WHY they rate things the way they do.

Return a JSON object with this exact structure:
{
  "narrative_complexity": "low" | "medium" | "high",
  "preferred_pacing": "fast" | "medium" | "slow_to_medium" | "slow",
  "moral_ambiguity_tolerance": "low" | "medium" | "high",
  "visual_importance": "low" | "medium" | "high",
  "humor_styles": ["dry", "dark", "slapstick", "witty", "absurd", "satirical"],
  "emotional_register": ["joy", "melancholy", "tension", "wonder", "dread", "warmth", "nostalgia"],
  "theme_affinities": ["identity", "power", "isolation", "family", "justice", "technology", "nature", "love", "survival", "class", "redemption"],
  "dealbreakers": ["things this user clearly dislikes based on low ratings"],
  "openness_to_foreign_language": "low" | "medium" | "high",
  "era_preference": "classic" | "modern" | "contemporary" | "no_strong_preference",
  "preference_orientation": "discovery" | "reliability" | "balanced",
  "summary": "2-3 sentence summary of this person's taste"
}

Rules:
- Base analysis on PATTERNS across ratings, not individual items
- Pay special attention to LOW ratings — dealbreakers are as important as preferences
- Only include values clearly supported by the ratings
- Return valid JSON only, no markdown`;

export async function generateTasteFingerprint(
  ratings: (Rating & { item: Item })[],
  previousFingerprint?: TasteFingerprint | null,
): Promise<{
  fingerprint: TasteFingerprint;
  evolutionNotes: string | null;
  tasteThesis: string | null;
  crossCategoryPatterns: string[] | null;
}> {
  const ratingLines: string[] = [];

  const byCategory = new Map<string, (Rating & { item: Item })[]>();
  for (const r of ratings) {
    const cat = r.item.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(r);
  }

  for (const [category, catRatings] of byCategory) {
    ratingLines.push(`\n[${category}]`);
    const sorted = [...catRatings].sort((a, b) => b.score - a.score);
    for (const r of sorted) {
      const genres = r.item.genres.length > 0 ? ` (${r.item.genres.join(', ')})` : '';
      const year = r.item.year ? `, ${r.item.year}` : '';
      ratingLines.push(`${r.score}/5 — ${r.item.title}${year}${genres}`);
    }
  }

  const distribution = computeRatingDistribution(ratings);

  let userMessage = `Here are this user's ${distribution.total_ratings} ratings across all categories:\n${ratingLines.join('\n')}`;

  userMessage += `\n\nRating behavior: mean ${distribution.mean}/5, std dev ${distribution.std_dev}, ${distribution.decisiveness} decisiveness, ${distribution.generosity} rater, 5-star rate ${distribution.five_star_rate}%`;

  if (previousFingerprint) {
    userMessage += `\n\nPREVIOUS FINGERPRINT (compare and note what has changed):\n${JSON.stringify(previousFingerprint, null, 2)}`;
  }

  userMessage += '\n\nAnalyse these ratings and extract their taste fingerprint.';

  if (previousFingerprint) {
    userMessage += ' Also provide a brief note on what has CHANGED since the previous fingerprint.';
  }

  if (byCategory.size > 1) {
    userMessage += ' Also identify 2-3 cross-category patterns — themes or preferences that appear across multiple categories.';
  }

  userMessage += ' Finally, write a "taste thesis" — a 3-4 sentence paragraph that could guide a recommendation engine on what to recommend and what to avoid for this person.';

  // Extended prompt asking for all outputs
  const extendedPrompt = FINGERPRINT_PROMPT.replace(
    'Return a JSON object with this exact structure:',
    'Return a JSON object with this exact structure (include ALL fields):'
  ).replace(
    'Return valid JSON only, no markdown',
    `Also include these additional fields in your JSON response:
  "evolution_notes": "What changed from the previous fingerprint (null if no previous)",
  "taste_thesis": "3-4 sentence paragraph guiding what to recommend and avoid",
  "cross_category_patterns": ["pattern 1", "pattern 2"] or null if only one category

Return valid JSON only, no markdown`
  );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No LLM API key available');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: extendedPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fingerprint generation failed: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    fingerprint: {
      narrative_complexity: parsed.narrative_complexity,
      preferred_pacing: parsed.preferred_pacing,
      moral_ambiguity_tolerance: parsed.moral_ambiguity_tolerance,
      visual_importance: parsed.visual_importance,
      humor_styles: parsed.humor_styles || [],
      emotional_register: parsed.emotional_register || [],
      theme_affinities: parsed.theme_affinities || [],
      dealbreakers: parsed.dealbreakers || [],
      openness_to_foreign_language: parsed.openness_to_foreign_language,
      era_preference: parsed.era_preference,
      preference_orientation: parsed.preference_orientation,
      summary: parsed.summary,
    },
    evolutionNotes: parsed.evolution_notes || null,
    tasteThesis: parsed.taste_thesis || null,
    crossCategoryPatterns: parsed.cross_category_patterns || null,
  };
}

// --- Miss Analysis ---

export async function generateMissAnalysis(
  misses: { title: string; reason: string | null; genres: string[] }[]
): Promise<MissAnalysis> {
  if (misses.length === 0) {
    return { pattern_misses: [], one_off_misses: [], intent_misses: [] };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No LLM API key available');

  const missLines = misses.map((m) => {
    const reason = m.reason ? ` (reason: ${m.reason})` : '';
    const genres = m.genres.length > 0 ? ` [${m.genres.join(', ')}]` : '';
    return `- ${m.title}${genres}${reason}`;
  });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyse these rejected recommendations and identify patterns. Return JSON:
{
  "pattern_misses": ["recurring patterns in what the user rejects — be specific about WHY"],
  "one_off_misses": ["items rejected for one-time reasons like 'already seen'"],
  "intent_misses": ["cases where the recommendation misread what the user wanted"]
}
Return valid JSON only.`,
        },
        {
          role: 'user',
          content: `These recommendations were rejected by the user:\n${missLines.join('\n')}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) return { pattern_misses: [], one_off_misses: [], intent_misses: [] };

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// --- Fingerprint Staleness Check ---

export const REGEN_THRESHOLDS = [30, 60, 100];
export const REGEN_INTERVAL_AFTER_100 = 50;
export const REGEN_MISS_THRESHOLD = 3;

export function shouldRegenerateFingerprint(
  currentRatingsCount: number,
  ratingsAtGeneration: number,
  badFeedbackSinceLastRegen: number
): boolean {
  // Check miss threshold
  if (badFeedbackSinceLastRegen >= REGEN_MISS_THRESHOLD) return true;

  // Check rating thresholds
  for (const threshold of REGEN_THRESHOLDS) {
    if (ratingsAtGeneration < threshold && currentRatingsCount >= threshold) {
      return true;
    }
  }

  // After 100, check every REGEN_INTERVAL_AFTER_100
  if (currentRatingsCount >= 100) {
    const sinceLastRegen = currentRatingsCount - ratingsAtGeneration;
    if (sinceLastRegen >= REGEN_INTERVAL_AFTER_100) return true;
  }

  return false;
}
