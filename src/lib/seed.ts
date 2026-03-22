import { SupabaseClient } from '@supabase/supabase-js';
import { fetchOMDBByTitle } from './omdb';

interface SeedItem {
  category: string;
  external_id: string;
  external_source: string;
  title: string;
  creator: string | null;
  description: string | null;
  genres: string[];
  year: number | null;
  image_url: string | null;
  metadata: Record<string, unknown>;
}

// Batch upsert items into the database
async function upsertItems(
  supabase: SupabaseClient,
  items: SeedItem[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const item of items) {
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('external_id', item.external_id)
      .eq('external_source', item.external_source)
      .eq('category', item.category)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('items').insert(item);
    if (!error) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}

// --- TMDB Seeding ---

export async function seedMovies(
  supabase: SupabaseClient,
  pages: number = 50,
  enrichWithOMDB: boolean = false
): Promise<{ inserted: number; skipped: number }> {
  const { getTopRatedMovies, getPopularMovies } = await import('./tmdb');
  let totalInserted = 0;
  let totalSkipped = 0;

  for (let page = 1; page <= pages; page++) {
    try {
      // Alternate between top_rated and popular for variety
      const fetcher = page % 2 === 0 ? getPopularMovies : getTopRatedMovies;
      const items = await fetcher(page);

      const seedItems: SeedItem[] = [];
      for (const item of items) {
        const metadata: Record<string, unknown> = {
          tmdb_rating: item.rating,
          tmdb_vote_count: item.vote_count,
        };

        // Optionally enrich with OMDB (IMDB + RT ratings)
        if (enrichWithOMDB) {
          try {
            const omdb = await fetchOMDBByTitle(item.title, item.year);
            if (omdb) {
              metadata.imdb_rating = omdb.imdbRating;
              metadata.imdb_votes = omdb.imdbVotes;
              metadata.rotten_tomatoes = omdb.rottenTomatoes;
              metadata.metascore = omdb.metascore;
              metadata.imdb_id = omdb.imdbId;
            }
          } catch { /* skip OMDB errors */ }
        }

        seedItems.push({
          category: 'movies',
          external_id: item.external_id,
          external_source: item.external_source,
          title: item.title,
          creator: item.creator,
          description: item.description,
          genres: item.genres,
          year: item.year,
          image_url: item.image_url,
          metadata,
        });
      }

      const { inserted, skipped } = await upsertItems(supabase, seedItems);
      totalInserted += inserted;
      totalSkipped += skipped;
    } catch (err) {
      console.error(`Seed movies page ${page} error:`, err);
    }
  }

  return { inserted: totalInserted, skipped: totalSkipped };
}

export async function seedTVShows(
  supabase: SupabaseClient,
  pages: number = 50
): Promise<{ inserted: number; skipped: number }> {
  const { getTopRatedTVShows, getPopularTVShows } = await import('./tmdb');
  let totalInserted = 0;
  let totalSkipped = 0;

  for (let page = 1; page <= pages; page++) {
    try {
      const fetcher = page % 2 === 0 ? getPopularTVShows : getTopRatedTVShows;
      const items = await fetcher(page);

      const seedItems: SeedItem[] = items.map((item) => ({
        category: 'tv_shows',
        external_id: item.external_id,
        external_source: item.external_source,
        title: item.title,
        creator: item.creator,
        description: item.description,
        genres: item.genres,
        year: item.year,
        image_url: item.image_url,
        metadata: {
          tmdb_rating: item.rating,
          tmdb_vote_count: item.vote_count,
        },
      }));

      const { inserted, skipped } = await upsertItems(supabase, seedItems);
      totalInserted += inserted;
      totalSkipped += skipped;
    } catch (err) {
      console.error(`Seed TV page ${page} error:`, err);
    }
  }

  return { inserted: totalInserted, skipped: totalSkipped };
}

export async function seedBooks(
  supabase: SupabaseClient,
  pages: number = 20
): Promise<{ inserted: number; skipped: number }> {
  const { getPopularBooks } = await import('./google-books');
  let totalInserted = 0;
  let totalSkipped = 0;

  for (let page = 1; page <= pages; page++) {
    try {
      const items = await getPopularBooks(page);

      const seedItems: SeedItem[] = items.map((item) => ({
        category: 'books',
        external_id: item.external_id,
        external_source: item.external_source,
        title: item.title,
        creator: item.creator,
        description: item.description,
        genres: item.genres,
        year: item.year,
        image_url: item.image_url,
        metadata: {
          google_rating: item.rating,
          google_vote_count: item.vote_count,
        },
      }));

      const { inserted, skipped } = await upsertItems(supabase, seedItems);
      totalInserted += inserted;
      totalSkipped += skipped;
    } catch (err) {
      console.error(`Seed books page ${page} error:`, err);
    }
  }

  // Also seed from Open Library
  try {
    const { searchOpenLibrary } = await import('./open-library');
    const subjects = ['bestseller', 'classic', 'award_winner', 'popular'];
    for (const subject of subjects) {
      const items = await searchOpenLibrary(subject);
      const seedItems: SeedItem[] = items.map((item: { external_id: string; external_source: string; category: string; title: string; creator: string | null; description: string; genres: string[]; year: number | null; image_url: string | null; rating: number; vote_count: number }) => ({
        ...item,
        description: item.description || null,
        metadata: {
          ol_rating: item.rating,
          ol_vote_count: item.vote_count,
        },
      }));
      const { inserted, skipped } = await upsertItems(supabase, seedItems);
      totalInserted += inserted;
      totalSkipped += skipped;
    }
  } catch (err) {
    console.error('Seed Open Library error:', err);
  }

  return { inserted: totalInserted, skipped: totalSkipped };
}

export async function seedMusicArtists(
  supabase: SupabaseClient
): Promise<{ inserted: number; skipped: number }> {
  const { getPopularMusicArtists } = await import('./spotify');
  let totalInserted = 0;
  let totalSkipped = 0;

  // 10 pages × 10 artists = ~100 artists per genre, 10 genres
  for (let page = 1; page <= 10; page++) {
    try {
      const items = await getPopularMusicArtists(page);

      const seedItems: SeedItem[] = items.map((item) => ({
        category: 'music_artists',
        external_id: item.external_id,
        external_source: item.external_source,
        title: item.title,
        creator: item.creator,
        description: item.description,
        genres: item.genres,
        year: item.year,
        image_url: item.image_url,
        metadata: {
          ...(item.metadata || {}),
          spotify_popularity: (item.metadata as Record<string, unknown>)?.popularity || 0,
        },
      }));

      const { inserted, skipped } = await upsertItems(supabase, seedItems);
      totalInserted += inserted;
      totalSkipped += skipped;
    } catch (err) {
      console.error(`Seed music page ${page} error:`, err);
    }
  }

  return { inserted: totalInserted, skipped: totalSkipped };
}

export async function seedPodcasts(
  supabase: SupabaseClient
): Promise<{ inserted: number; skipped: number }> {
  const { getPopularPodcasts } = await import('./spotify');
  let totalInserted = 0;
  let totalSkipped = 0;

  for (let page = 1; page <= 6; page++) {
    try {
      const items = await getPopularPodcasts(page);

      const seedItems: SeedItem[] = items.map((item) => ({
        category: 'podcasts',
        external_id: item.external_id,
        external_source: item.external_source,
        title: item.title,
        creator: item.creator,
        description: item.description,
        genres: item.genres,
        year: item.year,
        image_url: item.image_url,
        metadata: item.metadata || {},
      }));

      const { inserted, skipped } = await upsertItems(supabase, seedItems);
      totalInserted += inserted;
      totalSkipped += skipped;
    } catch (err) {
      console.error(`Seed podcasts page ${page} error:`, err);
    }
  }

  return { inserted: totalInserted, skipped: totalSkipped };
}
