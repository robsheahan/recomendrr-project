import { Item, Rating } from '@/types/database';
import {
  TasteFingerprint,
  RatingDistribution,
  MissAnalysis,
  computeGenreAverages,
} from './taste-fingerprint';
import { computeCreatorAffinities, formatCreatorAffinities } from './creator-affinity';

export interface TasteProfile {
  category: string;
  genre: string | null;
  intent: string | null;
  fingerprint: TasteFingerprint | null;
  tasteThesis: string | null;
  evolutionNotes: string | null;
  crossCategoryPatterns: string[] | null;
  distribution: RatingDistribution | null;
  crossMediaHighlights: { title: string; score: number; category: string }[];
  highlyRated: { title: string; score: number }[];
  moderatelyRated: { title: string; score: number }[];
  lowRated: { title: string; score: number }[];
  genreAverages: { genre: string; avg: number; count: number }[];
  notInterested: string[];
  previouslyRecommended: string[];
  missAnalysis: MissAnalysis | null;
  calibration: { high: number | null; medium: number | null; low: number | null; total: number } | null;
  collaborativeSection: string | null;
  creatorAffinitySection: string | null;
}

export function buildTasteProfile(
  ratings: (Rating & { item: Item })[],
  notInterestedTitles: string[],
  previouslyRecommendedTitles: string[],
  missAnalysis: MissAnalysis | null,
  category: string,
  genre: string | null = null,
  intent: string | null = null,
  fingerprint: TasteFingerprint | null = null,
  tasteThesis: string | null = null,
  evolutionNotes: string | null = null,
  crossCategoryPatterns: string[] | null = null,
  distribution: RatingDistribution | null = null,
  calibration: { high: number | null; medium: number | null; low: number | null; total: number } | null = null,
  collaborativeSection: string | null = null,
): TasteProfile {
  // Compute creator affinities
  const creatorAffinities = computeCreatorAffinities(ratings, category);
  const creatorAffinitySection = formatCreatorAffinities(creatorAffinities, category);
  const categoryRatings = ratings.filter((r) => r.item.category === category);

  // Cross-media highlights: top-rated items from OTHER categories
  const otherCategoryRatings = ratings
    .filter((r) => r.item.category !== category && r.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7)
    .map((r) => ({
      title: r.item.title,
      score: r.score,
      category: r.item.category,
    }));

  // Genre averages for this category
  const genreAverages = computeGenreAverages(ratings, category);

  return {
    category,
    genre,
    intent,
    fingerprint,
    tasteThesis,
    evolutionNotes,
    crossCategoryPatterns,
    distribution,
    crossMediaHighlights: otherCategoryRatings,
    highlyRated: categoryRatings
      .filter((r) => r.score >= 4)
      .sort((a, b) => b.score - a.score)
      .map((r) => ({ title: r.item.title, score: r.score })),
    moderatelyRated: categoryRatings
      .filter((r) => r.score === 3)
      .map((r) => ({ title: r.item.title, score: r.score })),
    lowRated: categoryRatings
      .filter((r) => r.score <= 2)
      .map((r) => ({ title: r.item.title, score: r.score })),
    genreAverages,
    notInterested: notInterestedTitles,
    previouslyRecommended: previouslyRecommendedTitles,
    missAnalysis,
    calibration,
    collaborativeSection,
    creatorAffinitySection,
  };
}

export function formatTasteProfileForLLM(profile: TasteProfile): string {
  const categoryLabels: Record<string, string> = {
    movies: 'movies',
    tv_shows: 'TV shows',
    documentaries: 'documentaries',
    fiction_books: 'fiction books',
    nonfiction_books: 'non-fiction books',
    podcasts: 'podcasts',
    music_artists: 'music artists',
  };

  const label = categoryLabels[profile.category] || profile.category;
  const lines: string[] = [];
  const totalCategoryRatings =
    profile.highlyRated.length + profile.moderatelyRated.length + profile.lowRated.length;

  // --- Taste thesis (most information-dense summary) ---
  if (profile.tasteThesis) {
    lines.push(`TASTE THESIS: ${profile.tasteThesis}`);
    lines.push('');
  }

  // --- Fingerprint ---
  if (profile.fingerprint) {
    const fp = profile.fingerprint;
    lines.push('TASTE FINGERPRINT:');
    lines.push(`- Narrative complexity: ${fp.narrative_complexity}`);
    lines.push(`- Pacing: ${fp.preferred_pacing}`);
    lines.push(`- Moral ambiguity tolerance: ${fp.moral_ambiguity_tolerance}`);
    if (fp.humor_styles.length > 0) lines.push(`- Humor: ${fp.humor_styles.join(', ')}`);
    if (fp.emotional_register.length > 0) lines.push(`- Emotional register: ${fp.emotional_register.join(', ')}`);
    if (fp.theme_affinities.length > 0) lines.push(`- Themes: ${fp.theme_affinities.join(', ')}`);
    if (fp.dealbreakers.length > 0) lines.push(`- Dealbreakers: ${fp.dealbreakers.join(', ')}`);
    lines.push(`- Foreign language: ${fp.openness_to_foreign_language}`);
    lines.push(`- Era: ${fp.era_preference}`);
    lines.push('');
  }

  // --- Evolution notes ---
  if (profile.evolutionNotes) {
    lines.push(`TASTE EVOLUTION: ${profile.evolutionNotes}`);
    lines.push('');
  }

  // --- Rating behavior ---
  if (profile.distribution) {
    const d = profile.distribution;
    lines.push('RATING BEHAVIOR:');
    lines.push(`- ${d.total_ratings} total ratings`);
    lines.push(`- Rating style: ${d.generosity} rater (mean ${d.mean}/5), ${d.decisiveness} decisiveness`);
    if (d.five_star_rate <= 15) {
      lines.push(`- 5-star items are rare (${d.five_star_rate}%) — a 5 from this user is a TRUE favorite`);
    } else if (d.five_star_rate >= 40) {
      lines.push(`- Rates generously (${d.five_star_rate}% are 5-star) — look at relative rankings, not absolute scores`);
    }
    lines.push('');
  }

  // --- Calibration data ---
  if (profile.calibration && profile.calibration.total >= 5) {
    lines.push('CALIBRATION (how accurate your previous predictions were for this user):');
    if (profile.calibration.high !== null)
      lines.push(`- "High confidence" hit rate: ${Math.round(profile.calibration.high * 100)}%`);
    if (profile.calibration.medium !== null)
      lines.push(`- "Medium confidence" hit rate: ${Math.round(profile.calibration.medium * 100)}%`);
    if (profile.calibration.low !== null)
      lines.push(`- "Low confidence" hit rate: ${Math.round(profile.calibration.low * 100)}%`);
    lines.push('- Only use "high confidence" if you believe hit rate will be 80%+');
    lines.push('');
  }

  // --- Cross-category patterns ---
  if (profile.crossCategoryPatterns && profile.crossCategoryPatterns.length > 0) {
    lines.push('CROSS-CATEGORY PATTERNS:');
    for (const pattern of profile.crossCategoryPatterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  // --- Cross-media highlights ---
  if (profile.crossMediaHighlights.length > 0) {
    lines.push('TOP ITEMS FROM OTHER CATEGORIES:');
    for (const item of profile.crossMediaHighlights.slice(0, 5)) {
      lines.push(`- ${item.title} (${item.score}/5, ${categoryLabels[item.category] || item.category})`);
    }
    lines.push('');
  }

  // --- Intent ---
  if (profile.intent) {
    lines.push(`CURRENT INTENT: "${profile.intent}"`);
    lines.push('');
  }

  // --- Genre constraint ---
  if (profile.genre) {
    lines.push(`GENRE CONSTRAINT: All 3 recommendations MUST be ${profile.genre}. Non-negotiable.`);
    lines.push('');
  }

  // --- Creator affinities ---
  if (profile.creatorAffinitySection) {
    lines.push(profile.creatorAffinitySection);
    lines.push('');
  }

  // --- Collaborative signals ---
  if (profile.collaborativeSection) {
    lines.push(profile.collaborativeSection);
    lines.push('');
  }

  // --- Category ratings (TIERED) ---
  lines.push(`CATEGORY RATINGS [${label}]:`);

  if (totalCategoryRatings <= 100) {
    // TIER 1: List everything (up to 100 ratings)
    if (profile.highlyRated.length > 0)
      lines.push(`Loved: ${profile.highlyRated.map((r) => `${r.title} (${r.score})`).join(', ')}`);
    if (profile.moderatelyRated.length > 0)
      lines.push(`Liked: ${profile.moderatelyRated.map((r) => r.title).join(', ')}`);
    if (profile.lowRated.length > 0)
      lines.push(`Disliked: ${profile.lowRated.map((r) => r.title).join(', ')}`);
  } else if (totalCategoryRatings <= 200) {
    // TIER 2: Top 15 + bottom 10 + genre averages
    const topItems = profile.highlyRated.slice(0, 15);
    const bottomItems = profile.lowRated.slice(0, 10);
    if (topItems.length > 0)
      lines.push(`Top rated: ${topItems.map((r) => `${r.title} (${r.score})`).join(', ')}`);
    if (bottomItems.length > 0)
      lines.push(`Lowest rated: ${bottomItems.map((r) => r.title).join(', ')}`);
    if (profile.genreAverages.length > 0) {
      lines.push('Genre preferences:');
      for (const ga of profile.genreAverages.slice(0, 10)) {
        lines.push(`  ${ga.genre}: avg ${ga.avg}/5 across ${ga.count} items`);
      }
    }
  } else {
    // TIER 3: Top 15 + bottom 10 + genre averages (200+ ratings)
    const topItems = profile.highlyRated.slice(0, 15);
    const bottomItems = profile.lowRated.slice(0, 10);
    if (topItems.length > 0)
      lines.push(`Top rated: ${topItems.map((r) => `${r.title} (${r.score})`).join(', ')}`);
    if (bottomItems.length > 0)
      lines.push(`Lowest rated: ${bottomItems.map((r) => r.title).join(', ')}`);
    if (profile.genreAverages.length > 0) {
      lines.push('Genre preferences:');
      for (const ga of profile.genreAverages.slice(0, 8)) {
        lines.push(`  ${ga.genre}: avg ${ga.avg}/5 across ${ga.count} items`);
      }
    }
  }
  lines.push('');

  // --- Miss patterns ---
  if (profile.missAnalysis) {
    const ma = profile.missAnalysis;
    if (ma.pattern_misses.length > 0) {
      lines.push('MISS PATTERNS (mistakes to avoid repeating):');
      for (const p of ma.pattern_misses) lines.push(`- ${p}`);
      lines.push('');
    }
    if (ma.intent_misses.length > 0) {
      lines.push('INTENT MISSES:');
      for (const m of ma.intent_misses) lines.push(`- ${m}`);
      lines.push('');
    }
    if (ma.one_off_misses.length > 0) {
      lines.push(`Already seen: ${ma.one_off_misses.join(', ')}`);
      lines.push('');
    }
  }

  // --- Exclusions ---
  if (profile.notInterested.length > 0) {
    lines.push(`NOT INTERESTED IN: ${profile.notInterested.join(', ')}`);
    lines.push('');
  }

  if (profile.previouslyRecommended.length > 0) {
    lines.push(`PREVIOUSLY RECOMMENDED (exclude): ${profile.previouslyRecommended.join(', ')}`);
    lines.push('');
  }

  // --- Request ---
  const genreClause = profile.genre ? ` in the ${profile.genre} genre` : '';
  lines.push(`Recommend 12 ${label}${genreClause} for this user. Provide exactly 12 different recommendations. Ensure variety — mix different sub-genres, eras, and styles.`);
  lines.push('Return as JSON: {"recommendations": [{"title": "...", "year": 2020, "reason": "...", "confidence": "high"}]}');

  return lines.join('\n');
}
