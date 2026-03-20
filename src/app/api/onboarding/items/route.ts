import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getPopularByCategory, type MediaItemData } from '@/lib/tmdb';

// For TMDB categories, fetch well-known items across decades
async function getWellKnownItems(
  category: string,
  page: number
): Promise<MediaItemData[]> {
  const isTmdbCategory = ['movies', 'tv_shows', 'documentaries'].includes(category);

  if (!isTmdbCategory) {
    // For books, music, podcasts — the default popular/search works fine
    return getPopularByCategory(category, page);
  }

  // For TMDB categories, fetch from multiple pages of top_rated + popular
  // to get a diverse mix of well-known items across eras
  const { getTopRatedMovies, getPopularMovies } = await import('@/lib/tmdb');
  const { getTopRatedTVShows, getPopularTVShows } = await import('@/lib/tmdb');

  let allItems: MediaItemData[] = [];

  if (category === 'movies') {
    // Fetch multiple pages to get a broad mix
    const pageOffset = (page - 1) * 3;
    const [topRated1, topRated2, popular1] = await Promise.all([
      getTopRatedMovies(pageOffset + 1),
      getTopRatedMovies(pageOffset + 2),
      getPopularMovies(pageOffset + 1),
    ]);
    allItems = [...topRated1, ...topRated2, ...popular1];
  } else if (category === 'tv_shows') {
    const pageOffset = (page - 1) * 3;
    const [topRated1, topRated2, popular1] = await Promise.all([
      getTopRatedTVShows(pageOffset + 1),
      getTopRatedTVShows(pageOffset + 2),
      getPopularTVShows(pageOffset + 1),
    ]);
    allItems = [...topRated1, ...topRated2, ...popular1];
  } else if (category === 'documentaries') {
    return getPopularByCategory(category, page);
  }

  // Deduplicate by external_id
  const seen = new Set<string>();
  const unique = allItems.filter((item) => {
    if (seen.has(item.external_id)) return false;
    seen.add(item.external_id);
    return true;
  });

  // Sort by vote count (most well-known first) with some randomness
  // to avoid always showing the exact same order
  return unique
    .filter((item) => item.vote_count > 100)
    .sort((a, b) => {
      // Group into tiers then shuffle within tier
      const tierA = Math.floor(Math.log10(a.vote_count + 1));
      const tierB = Math.floor(Math.log10(b.vote_count + 1));
      if (tierB !== tierA) return tierB - tierA;
      return Math.random() - 0.5;
    });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get('category');
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1');

  if (!category) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  }

  try {
    const items = await getWellKnownItems(category, page);

    // Get items the user has already rated in this category
    const { data: existingRatings } = await supabase
      .from('ratings')
      .select('item_id, items!inner(external_id, category)')
      .eq('user_id', user.id);

    const ratedExternalIds = new Set(
      (existingRatings || [])
        .filter((r: Record<string, unknown>) => {
          const item = r.items as Record<string, unknown>;
          return item.category === category;
        })
        .map((r: Record<string, unknown>) => {
          const item = r.items as Record<string, unknown>;
          return item.external_id as string;
        })
    );

    // Filter out already-rated items
    const unratedItems = items.filter(
      (item) => !ratedExternalIds.has(item.external_id)
    );

    return NextResponse.json({ items: unratedItems });
  } catch (err) {
    console.error('Error fetching onboarding items:', err);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}
