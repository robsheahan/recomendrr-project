import { Item, Rating } from '@/types/database';

export interface CreatorAffinity {
  creator: string;
  avgRating: number;
  count: number;
  titles: string[];
  signal: 'strong_boost' | 'boost' | 'neutral' | 'suppress' | 'strong_suppress';
}

export function computeCreatorAffinities(
  ratings: (Rating & { item: Item })[],
  category: string
): CreatorAffinity[] {
  const categoryRatings = ratings.filter(
    (r) => r.item.category === category && r.item.creator
  );

  // Group by creator
  const byCreator = new Map<string, { scores: number[]; titles: string[] }>();
  for (const r of categoryRatings) {
    const creator = r.item.creator!;
    if (!byCreator.has(creator)) {
      byCreator.set(creator, { scores: [], titles: [] });
    }
    const entry = byCreator.get(creator)!;
    entry.scores.push(r.score);
    entry.titles.push(r.item.title);
  }

  // Only include creators with 2+ ratings (one rating isn't a pattern)
  const affinities: CreatorAffinity[] = [];
  for (const [creator, data] of byCreator) {
    if (data.scores.length < 2) continue;

    const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const roundedAvg = Math.round(avg * 10) / 10;

    let signal: CreatorAffinity['signal'];
    if (avg >= 4.5 && data.scores.length >= 3) signal = 'strong_boost';
    else if (avg >= 4.0) signal = 'boost';
    else if (avg <= 1.5 && data.scores.length >= 2) signal = 'strong_suppress';
    else if (avg <= 2.5) signal = 'suppress';
    else signal = 'neutral';

    if (signal === 'neutral') continue; // Only include meaningful signals

    affinities.push({
      creator,
      avgRating: roundedAvg,
      count: data.scores.length,
      titles: data.titles,
      signal,
    });
  }

  // Sort: strong boosts first, then boosts, then suppressions
  return affinities.sort((a, b) => {
    const order = { strong_boost: 0, boost: 1, suppress: 2, strong_suppress: 3, neutral: 4 };
    return order[a.signal] - order[b.signal];
  });
}

export function formatCreatorAffinities(affinities: CreatorAffinity[], category: string): string | null {
  if (affinities.length === 0) return null;

  const creatorLabel: Record<string, string> = {
    movies: 'Director',
    tv_shows: 'Creator',
    documentaries: 'Director',
    fiction_books: 'Author',
    nonfiction_books: 'Author',
    podcasts: 'Host',
    music_artists: 'Artist',
  };

  const label = creatorLabel[category] || 'Creator';
  const lines = [`${label.toUpperCase()} AFFINITIES (based on rating patterns):`];

  for (const a of affinities.slice(0, 10)) {
    if (a.signal === 'strong_boost') {
      lines.push(`- ${a.creator}: avg ${a.avgRating}/5 across ${a.count} items — STRONGLY favour their other work`);
    } else if (a.signal === 'boost') {
      lines.push(`- ${a.creator}: avg ${a.avgRating}/5 across ${a.count} items — favour their other work`);
    } else if (a.signal === 'suppress') {
      lines.push(`- ${a.creator}: avg ${a.avgRating}/5 across ${a.count} items — avoid their other work`);
    } else if (a.signal === 'strong_suppress') {
      lines.push(`- ${a.creator}: avg ${a.avgRating}/5 across ${a.count} items — STRONGLY avoid their work`);
    }
  }

  return lines.join('\n');
}
