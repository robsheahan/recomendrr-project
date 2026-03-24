import { Item, Rating } from '@/types/database';

type ItemTags = Record<string, unknown>;

export interface TagPreferences {
  lovedSubGenres: string[];
  dislikedSubGenres: string[];
  lovedThemes: string[];
  dislikedThemes: string[];
  lovedTones: string[];
  dislikedTones: string[];
  lovedSpecialTags: string[];
  dislikedSpecialTags: string[];
  contentAvoidance: string[];
}

export function analyseTagPreferences(
  ratings: (Rating & { item: Item })[],
  category: string
): TagPreferences | null {
  const categoryRatings = ratings.filter((r) => {
    const cat = r.item.category;
    if (category === 'books') return ['books', 'fiction_books', 'nonfiction_books'].includes(cat);
    if (category === 'movies') return ['movies', 'documentaries'].includes(cat);
    return cat === category;
  });

  const loved = categoryRatings.filter((r) => r.score >= 4);
  const disliked = categoryRatings.filter((r) => r.score <= 2);

  if (loved.length < 3) return null; // Not enough data

  function extractTags(items: (Rating & { item: Item })[]): ItemTags[] {
    return items
      .map((r) => {
        const metadata = r.item.metadata as Record<string, unknown> | null;
        return metadata?.tags as ItemTags | undefined;
      })
      .filter((t): t is ItemTags => !!t);
  }

  function countOccurrences(tags: ItemTags[], field: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const tag of tags) {
      const values = tag[field];
      if (Array.isArray(values)) {
        for (const v of values) {
          counts[v] = (counts[v] || 0) + 1;
        }
      }
    }
    return counts;
  }

  function topN(counts: Record<string, number>, n: number, minCount: number = 2): string[] {
    return Object.entries(counts)
      .filter(([, count]) => count >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([tag]) => tag);
  }

  const lovedTags = extractTags(loved);
  const dislikedTags = extractTags(disliked);

  if (lovedTags.length < 2) return null;

  const lovedSubGenres = topN(countOccurrences(lovedTags, 'sub_genres'), 5);
  const lovedThemes = topN(countOccurrences(lovedTags, 'themes'), 5);
  const lovedTones = topN(countOccurrences(lovedTags, 'emotional_tone'), 5);
  const lovedSpecialTags = topN(countOccurrences(lovedTags, 'special_tags'), 5);

  const dislikedSubGenres = topN(countOccurrences(dislikedTags, 'sub_genres'), 5, 1);
  const dislikedThemes = topN(countOccurrences(dislikedTags, 'themes'), 3, 1);
  const dislikedTones = topN(countOccurrences(dislikedTags, 'emotional_tone'), 3, 1);
  const dislikedSpecialTags = topN(countOccurrences(dislikedTags, 'special_tags'), 3, 1);
  const contentAvoidance = topN(countOccurrences(dislikedTags, 'content_warnings'), 3, 1)
    .filter((w) => w !== 'none');

  return {
    lovedSubGenres,
    dislikedSubGenres,
    lovedThemes,
    dislikedThemes,
    lovedTones,
    dislikedTones,
    lovedSpecialTags,
    dislikedSpecialTags,
    contentAvoidance,
  };
}

export function formatTagPreferences(prefs: TagPreferences): string | null {
  const lines: string[] = ['TAG-BASED PREFERENCES (derived from patterns in rated items):'];
  let hasContent = false;

  if (prefs.lovedSubGenres.length > 0) {
    lines.push(`- Loves: ${prefs.lovedSubGenres.join(', ')}`);
    hasContent = true;
  }
  if (prefs.dislikedSubGenres.length > 0) {
    lines.push(`- Dislikes: ${prefs.dislikedSubGenres.join(', ')}`);
    hasContent = true;
  }
  if (prefs.lovedThemes.length > 0) {
    lines.push(`- Drawn to themes: ${prefs.lovedThemes.join(', ')}`);
    hasContent = true;
  }
  if (prefs.lovedTones.length > 0) {
    lines.push(`- Preferred tone: ${prefs.lovedTones.join(', ')}`);
    hasContent = true;
  }
  if (prefs.dislikedTones.length > 0) {
    lines.push(`- Avoids tone: ${prefs.dislikedTones.join(', ')}`);
    hasContent = true;
  }
  if (prefs.lovedSpecialTags.length > 0) {
    lines.push(`- Loves when: ${prefs.lovedSpecialTags.join(', ')}`);
    hasContent = true;
  }
  if (prefs.contentAvoidance.length > 0) {
    lines.push(`- Content to avoid: ${prefs.contentAvoidance.join(', ')}`);
    hasContent = true;
  }

  return hasContent ? lines.join('\n') : null;
}
