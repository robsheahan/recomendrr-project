import { SupabaseClient } from '@supabase/supabase-js';

export interface LocalSearchResult {
  id: string;
  external_id: string;
  external_source: string;
  category: string;
  title: string;
  creator: string | null;
  description: string | null;
  genres: string[];
  year: number | null;
  image_url: string | null;
  metadata: Record<string, unknown> | null;
  rating: number;
  vote_count: number;
}

// Search our local items table first
export async function searchLocalItems(
  supabase: SupabaseClient,
  query: string,
  category: string,
  limit: number = 10
): Promise<LocalSearchResult[]> {
  // Map category to DB values
  let categories: string[];
  if (category === 'books') {
    categories = ['books', 'fiction_books', 'nonfiction_books'];
  } else if (category === 'movies') {
    categories = ['movies', 'documentaries'];
  } else {
    categories = [category];
  }

  // Use ilike for fuzzy matching
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .in('category', categories)
    .ilike('title', `%${query}%`)
    .order('title')
    .limit(limit);

  if (error || !data) return [];

  const queryLower = query.toLowerCase();

  // Sort by relevance: exact match > starts with > contains
  data.sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    const aExact = aTitle === queryLower ? 0 : aTitle.startsWith(queryLower) ? 1 : 2;
    const bExact = bTitle === queryLower ? 0 : bTitle.startsWith(queryLower) ? 1 : 2;
    return aExact - bExact;
  });

  return data.map((item) => {
    const metadata = (item.metadata || {}) as Record<string, unknown>;
    return {
      id: item.id,
      external_id: item.external_id,
      external_source: item.external_source,
      category: item.category,
      title: item.title,
      creator: item.creator,
      description: item.description,
      genres: item.genres || [],
      year: item.year,
      image_url: item.image_url,
      metadata,
      rating: (metadata.imdb_rating as number) || (metadata.google_rating as number) || 0,
      vote_count: (metadata.imdb_votes as number) || (metadata.google_vote_count as number) || 0,
    };
  });
}
