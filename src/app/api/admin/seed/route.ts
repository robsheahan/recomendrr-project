import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  seedMovies,
  seedTVShows,
  seedBooks,
  seedMusicArtists,
  seedPodcasts,
} from '@/lib/seed';

export const maxDuration = 300; // 5 min timeout for seeding

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category, pages, enrichWithOMDB } = await request.json();

  const results: Record<string, { inserted: number; skipped: number }> = {};

  try {
    if (!category || category === 'movies') {
      results.movies = await seedMovies(supabase, pages || 50, enrichWithOMDB);
    }
    if (!category || category === 'tv_shows') {
      results.tv_shows = await seedTVShows(supabase, pages || 50);
    }
    if (!category || category === 'books') {
      results.books = await seedBooks(supabase, pages || 20);
    }
    if (!category || category === 'music_artists') {
      results.music_artists = await seedMusicArtists(supabase);
    }
    if (!category || category === 'podcasts') {
      results.podcasts = await seedPodcasts(supabase);
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, results }, { status: 500 });
  }
}
