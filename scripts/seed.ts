/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

async function tmdbFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY!);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function omdbFetch(title: string, year?: number) {
  if (!OMDB_API_KEY) return null;
  const params = new URLSearchParams({ apikey: OMDB_API_KEY, t: title, type: 'movie' });
  if (year) params.set('y', String(year));
  const res = await fetch(`https://www.omdbapi.com/?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.Response !== 'True') return null;
  return {
    imdb_rating: data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
    imdb_votes: data.imdbVotes !== 'N/A' ? parseInt(data.imdbVotes.replace(/,/g, '')) : null,
    rotten_tomatoes: data.Ratings?.find((r: { Source: string; Value: string }) => r.Source === 'Rotten Tomatoes')?.Value?.replace('%', '') ? parseInt(data.Ratings.find((r: { Source: string }) => r.Source === 'Rotten Tomatoes').Value.replace('%', '')) : null,
    metascore: data.Metascore !== 'N/A' ? parseInt(data.Metascore) : null,
    imdb_id: data.imdbID || null,
  };
}

const MOVIE_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  53: 'Thriller', 10752: 'War', 37: 'Western',
};

const TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  9648: 'Mystery', 10765: 'Sci-Fi & Fantasy', 10768: 'War & Politics', 37: 'Western',
};

async function seedMovies(pages: number, withOMDB: boolean) {
  let inserted = 0, skipped = 0;

  for (let page = 1; page <= pages; page++) {
    const endpoint = page % 2 === 0 ? '/movie/popular' : '/movie/top_rated';
    const data = await tmdbFetch(endpoint, { page: String(page) });

    for (const m of data.results) {
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('external_id', String(m.id))
        .eq('external_source', 'tmdb')
        .eq('category', 'movies')
        .single();

      if (existing) { skipped++; continue; }

      const metadata: Record<string, unknown> = {
        tmdb_rating: m.vote_average,
        tmdb_vote_count: m.vote_count,
      };

      if (withOMDB && m.title) {
        const year = m.release_date ? parseInt(m.release_date.slice(0, 4)) : undefined;
        const omdb = await omdbFetch(m.title, year);
        if (omdb) Object.assign(metadata, omdb);
      }

      const { error } = await supabase.from('items').insert({
        category: 'movies',
        external_id: String(m.id),
        external_source: 'tmdb',
        title: m.title,
        creator: null,
        description: m.overview || '',
        genres: (m.genre_ids || []).map((id: number) => MOVIE_GENRES[id]).filter(Boolean),
        year: m.release_date ? parseInt(m.release_date.slice(0, 4)) : null,
        image_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
        metadata,
      });

      if (!error) inserted++;
      else skipped++;
    }

    process.stdout.write(`\rMovies: page ${page}/${pages} | ${inserted} inserted, ${skipped} skipped`);
  }
  console.log(`\nMovies done: ${inserted} inserted, ${skipped} skipped`);
}

async function seedTVShows(pages: number) {
  let inserted = 0, skipped = 0;

  for (let page = 1; page <= pages; page++) {
    const endpoint = page % 2 === 0 ? '/tv/popular' : '/tv/top_rated';
    const data = await tmdbFetch(endpoint, { page: String(page) });

    for (const t of data.results) {
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('external_id', String(t.id))
        .eq('external_source', 'tmdb')
        .eq('category', 'tv_shows')
        .single();

      if (existing) { skipped++; continue; }

      const { error } = await supabase.from('items').insert({
        category: 'tv_shows',
        external_id: String(t.id),
        external_source: 'tmdb',
        title: t.name,
        creator: null,
        description: t.overview || '',
        genres: (t.genre_ids || []).map((id: number) => TV_GENRES[id]).filter(Boolean),
        year: t.first_air_date ? parseInt(t.first_air_date.slice(0, 4)) : null,
        image_url: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : null,
        metadata: { tmdb_rating: t.vote_average, tmdb_vote_count: t.vote_count },
      });

      if (!error) inserted++;
      else skipped++;
    }

    process.stdout.write(`\rTV Shows: page ${page}/${pages} | ${inserted} inserted, ${skipped} skipped`);
  }
  console.log(`\nTV Shows done: ${inserted} inserted, ${skipped} skipped`);
}

async function main() {
  const category = process.argv[2] || 'all';
  const pages = parseInt(process.argv[3] || '50');
  const withOMDB = process.argv.includes('--omdb');

  console.log(`Seeding ${category} (${pages} pages)${withOMDB ? ' with OMDB' : ''}...\n`);

  if (category === 'all' || category === 'movies') {
    await seedMovies(pages, withOMDB);
  }
  if (category === 'all' || category === 'tv_shows') {
    await seedTVShows(pages);
  }

  console.log('\nDone!');
}

main().catch(console.error);
