import { Item, Rating } from '@/types/database';
import { TasteFingerprint } from './taste-fingerprint';

export interface TasteProfile {
  category: string;
  genre: string | null;
  intent: string | null;
  fingerprint: TasteFingerprint | null;
  crossMediaHighlights: { title: string; score: number; category: string }[];
  highlyRated: { title: string; score: number }[];
  moderatelyRated: { title: string; score: number }[];
  lowRated: { title: string; score: number }[];
  notInterested: string[];
  previouslyRecommended: string[];
  previousMisses: { title: string; feedback: string }[];
}

export function buildTasteProfile(
  ratings: (Rating & { item: Item })[],
  notInterestedTitles: string[],
  previouslyRecommendedTitles: string[],
  previousMisses: { title: string; feedback: string }[],
  category: string,
  genre: string | null = null,
  intent: string | null = null,
  fingerprint: TasteFingerprint | null = null
): TasteProfile {
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

  return {
    category,
    genre,
    intent,
    fingerprint,
    crossMediaHighlights: otherCategoryRatings,
    highlyRated: categoryRatings
      .filter((r) => r.score >= 4)
      .map((r) => ({ title: r.item.title, score: r.score })),
    moderatelyRated: categoryRatings
      .filter((r) => r.score === 3)
      .map((r) => ({ title: r.item.title, score: r.score })),
    lowRated: categoryRatings
      .filter((r) => r.score <= 2)
      .map((r) => ({ title: r.item.title, score: r.score })),
    notInterested: notInterestedTitles,
    previouslyRecommended: previouslyRecommendedTitles,
    previousMisses,
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

  // Taste fingerprint first — primes the LLM to reason about the person
  if (profile.fingerprint) {
    const fp = profile.fingerprint;
    lines.push('TASTE FINGERPRINT:');
    lines.push(`- Narrative complexity: ${fp.narrative_complexity}`);
    lines.push(`- Pacing preference: ${fp.preferred_pacing}`);
    lines.push(`- Moral ambiguity tolerance: ${fp.moral_ambiguity_tolerance}`);
    lines.push(`- Visual importance: ${fp.visual_importance}`);
    if (fp.humor_styles.length > 0) {
      lines.push(`- Humor styles: ${fp.humor_styles.join(', ')}`);
    }
    if (fp.emotional_register.length > 0) {
      lines.push(`- Emotional register: ${fp.emotional_register.join(', ')}`);
    }
    if (fp.theme_affinities.length > 0) {
      lines.push(`- Theme affinities: ${fp.theme_affinities.join(', ')}`);
    }
    if (fp.dealbreakers.length > 0) {
      lines.push(`- Dealbreakers: ${fp.dealbreakers.join(', ')}`);
    }
    lines.push(`- Foreign language openness: ${fp.openness_to_foreign_language}`);
    lines.push(`- Era preference: ${fp.era_preference}`);
    lines.push(`- Orientation: ${fp.preference_orientation}`);
    lines.push(`- Summary: ${fp.summary}`);
    lines.push('');
  }

  // Cross-media highlights
  if (profile.crossMediaHighlights.length > 0) {
    lines.push('CROSS-MEDIA HIGHLIGHTS (top items from other categories):');
    for (const item of profile.crossMediaHighlights) {
      lines.push(`- ${item.title} (${item.score}/5, ${categoryLabels[item.category] || item.category})`);
    }
    lines.push('');
  }

  // Current intent
  if (profile.intent) {
    lines.push(`CURRENT INTENT: "${profile.intent}"`);
    lines.push('');
  }

  // Genre constraint
  if (profile.genre) {
    lines.push(`GENRE CONSTRAINT: All 3 recommendations MUST be in or closely related to the ${profile.genre} genre.`);
    lines.push('');
  }

  // Category ratings — simplified format
  lines.push(`CATEGORY RATINGS [${label}]:`);
  if (profile.highlyRated.length > 0) {
    lines.push(`Loved: ${profile.highlyRated.map((r) => r.title).join(', ')}`);
  }
  if (profile.moderatelyRated.length > 0) {
    lines.push(`Liked: ${profile.moderatelyRated.map((r) => r.title).join(', ')}`);
  }
  if (profile.lowRated.length > 0) {
    lines.push(`Disliked: ${profile.lowRated.map((r) => r.title).join(', ')}`);
  }
  lines.push('');

  // Previous misses — critical for learning
  if (profile.previousMisses.length > 0) {
    lines.push('PREVIOUS MISSES (you recommended these but the user flagged them as bad recommendations — learn from this):');
    for (const miss of profile.previousMisses) {
      lines.push(`- ${miss.title}`);
    }
    lines.push('');
  }

  if (profile.notInterested.length > 0) {
    lines.push('NOT INTERESTED IN:');
    for (const title of profile.notInterested) {
      lines.push(`- ${title}`);
    }
    lines.push('');
  }

  if (profile.previouslyRecommended.length > 0) {
    lines.push('PREVIOUSLY RECOMMENDED (do not suggest again):');
    for (const title of profile.previouslyRecommended) {
      lines.push(`- ${title}`);
    }
    lines.push('');
  }

  const genreClause = profile.genre ? ` in the ${profile.genre} genre` : '';
  lines.push(`Recommend 3 ${label}${genreClause} for this user.`);
  lines.push('');
  lines.push('Return as JSON with this exact structure:');
  lines.push('{"recommendations": [{"title": "...", "year": 2020, "reason": "...", "confidence": "high"}]}');

  return lines.join('\n');
}
