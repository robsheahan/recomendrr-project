import { Item, Rating } from '@/types/database';

export interface QualityFloor {
  avgImdbOfTopRated: number | null; // Avg IMDB of user's 4-5 star items
  avgImdbOfLowRated: number | null; // Avg IMDB of user's 1-2 star items
  qualityFloor: number | null; // Minimum IMDB to recommend
  qualityGap: number | null; // Gap between user's loved and disliked
  totalWithImdb: number;
  pattern: string; // Description for the LLM
}

export function computeQualityFloor(
  ratings: (Rating & { item: Item })[],
  category: string
): QualityFloor | null {
  // Filter to category
  const categoryRatings = ratings.filter((r) => {
    const cat = r.item.category;
    if (category === 'books') return ['books', 'fiction_books', 'nonfiction_books'].includes(cat);
    if (category === 'movies') return ['movies', 'documentaries'].includes(cat);
    return cat === category;
  });

  // Get IMDB ratings from metadata
  const withImdb = categoryRatings
    .map((r) => {
      const meta = r.item.metadata as Record<string, unknown> | null;
      const imdb = meta?.imdb_rating as number | undefined;
      return imdb ? { userScore: r.score, imdb, title: r.item.title } : null;
    })
    .filter((r): r is { userScore: number; imdb: number; title: string } => r !== null);

  if (withImdb.length < 5) return null;

  // Compute avg IMDB of items the user rated highly (4-5)
  const topRated = withImdb.filter((r) => r.userScore >= 4);
  const lowRated = withImdb.filter((r) => r.userScore <= 2);

  const avgTop = topRated.length > 0
    ? topRated.reduce((sum, r) => sum + r.imdb, 0) / topRated.length
    : null;

  const avgLow = lowRated.length > 0
    ? lowRated.reduce((sum, r) => sum + r.imdb, 0) / lowRated.length
    : null;

  // Quality floor = slightly below the average of their top-rated items
  // If they consistently love 8.0+ IMDB films, floor should be ~7.0
  const qualityFloor = avgTop ? Math.round((avgTop - 1.0) * 10) / 10 : null;

  const qualityGap = avgTop && avgLow ? Math.round((avgTop - avgLow) * 10) / 10 : null;

  // Generate pattern description
  let pattern = '';
  if (avgTop && qualityFloor) {
    pattern = `This user's highly-rated items average ${avgTop.toFixed(1)}/10 on IMDB.`;
    if (avgLow) {
      pattern += ` Their low-rated items average ${avgLow.toFixed(1)}/10.`;
    }
    pattern += ` Strongly prefer items rated ${qualityFloor.toFixed(1)}+ on IMDB. Do not recommend items below ${Math.max(qualityFloor - 0.5, 5.0).toFixed(1)}/10 unless the user explicitly asks for hidden gems or niche content.`;

    // Check if user diverges from consensus
    const divergences = withImdb.filter((r) =>
      (r.userScore >= 4 && r.imdb < 6.5) || (r.userScore <= 2 && r.imdb > 7.5)
    );
    if (divergences.length >= 3) {
      pattern += ` Note: this user sometimes diverges from IMDB consensus — they have strong personal taste that doesn't always align with crowd ratings.`;
    }
  }

  return {
    avgImdbOfTopRated: avgTop ? Math.round(avgTop * 10) / 10 : null,
    avgImdbOfLowRated: avgLow ? Math.round(avgLow * 10) / 10 : null,
    qualityFloor,
    qualityGap,
    totalWithImdb: withImdb.length,
    pattern,
  };
}

export function formatQualityFloor(qf: QualityFloor): string | null {
  if (!qf.pattern) return null;
  return `QUALITY FLOOR:\n${qf.pattern}`;
}
