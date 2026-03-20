import { Item, Rating } from '@/types/database';

export interface TasteProfile {
  category: string;
  genre: string | null;
  highlyRated: { title: string; score: number; year: number | null; genres: string[] }[];
  moderatelyRated: { title: string; score: number; year: number | null; genres: string[] }[];
  lowRated: { title: string; score: number; year: number | null; genres: string[] }[];
  notInterested: string[];
  previouslyRecommended: string[];
}

export function buildTasteProfile(
  ratings: (Rating & { item: Item })[],
  notInterestedTitles: string[],
  previouslyRecommendedTitles: string[],
  category: string,
  genre: string | null = null
): TasteProfile {
  const categoryRatings = ratings.filter((r) => r.item.category === category);

  const mapRating = (r: Rating & { item: Item }) => ({
    title: r.item.title,
    score: r.score,
    year: r.item.year,
    genres: r.item.genres,
  });

  return {
    category,
    genre,
    highlyRated: categoryRatings.filter((r) => r.score >= 4).map(mapRating),
    moderatelyRated: categoryRatings.filter((r) => r.score === 3).map(mapRating),
    lowRated: categoryRatings.filter((r) => r.score <= 2).map(mapRating),
    notInterested: notInterestedTitles,
    previouslyRecommended: previouslyRecommendedTitles,
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

  lines.push(`Here is my taste profile for ${label}:\n`);

  if (profile.genre) {
    lines.push(`GENRE PREFERENCE: I'm currently in the mood for ${profile.genre}. All 3 recommendations MUST be in or closely related to the ${profile.genre} genre.\n`);
  }

  if (profile.highlyRated.length > 0) {
    lines.push('HIGHLY RATED (4-5 stars):');
    for (const item of profile.highlyRated) {
      const genres = item.genres.length > 0 ? item.genres.join('/') : '';
      const yearStr = item.year ? `, ${item.year}` : '';
      lines.push(`- ${item.title} (${item.score}/5)${yearStr}${genres ? `, ${genres}` : ''}`);
    }
    lines.push('');
  }

  if (profile.moderatelyRated.length > 0) {
    lines.push('MODERATELY RATED (3 stars):');
    for (const item of profile.moderatelyRated) {
      const genres = item.genres.length > 0 ? item.genres.join('/') : '';
      const yearStr = item.year ? `, ${item.year}` : '';
      lines.push(`- ${item.title} (${item.score}/5)${yearStr}${genres ? `, ${genres}` : ''}`);
    }
    lines.push('');
  }

  if (profile.lowRated.length > 0) {
    lines.push('LOW RATED (1-2 stars):');
    for (const item of profile.lowRated) {
      const genres = item.genres.length > 0 ? item.genres.join('/') : '';
      const yearStr = item.year ? `, ${item.year}` : '';
      lines.push(`- ${item.title} (${item.score}/5)${yearStr}${genres ? `, ${genres}` : ''}`);
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
  lines.push(`Based on this profile, recommend 3 ${label}${genreClause} I would enjoy.`);
  lines.push('For each recommendation, provide:');
  lines.push('1. Title and year');
  lines.push('2. A brief reason tied to my specific taste profile');
  lines.push('3. A confidence score (high/medium/low)');
  lines.push('');
  lines.push('Return as JSON with this exact structure:');
  lines.push('{"recommendations": [{"title": "...", "year": 2020, "reason": "...", "confidence": "high"}]}');

  return lines.join('\n');
}
