/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const GOOGLE_BOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY;

// --- LLM Title Generation ---

async function generateTitleList(category: string, prompt: string): Promise<{ title: string; creator: string }[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a ${category} expert. Return a JSON array of objects with "title" and "creator" fields. Return exactly 100 items. Include well-known, popular items that real people would search for. No duplicates. Return valid JSON only — just the array, no markdown.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return parsed.items || parsed.books || parsed.movies || parsed.shows || parsed.artists || parsed.podcasts || parsed;
}

// --- Google Books Lookup ---

async function lookupBookOnGoogleBooks(title: string, author: string | null): Promise<{
  external_id: string;
  description: string;
  genres: string[];
  year: number | null;
  image_url: string | null;
  rating: number;
  vote_count: number;
} | null> {
  if (!GOOGLE_BOOKS_KEY) return null;
  const query = author ? `${title} ${author}` : title;
  const url = `https://www.googleapis.com/books/v1/volumes?key=${GOOGLE_BOOKS_KEY}&q=${encodeURIComponent(query)}&maxResults=1&orderBy=relevance&langRestrict=en`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  const info = item.volumeInfo || {};
  const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null;
  const cover = info.imageLinks?.thumbnail?.replace('http://', 'https://') || null;

  return {
    external_id: item.id,
    description: info.description || '',
    genres: info.categories || [],
    year: isNaN(year as number) ? null : year,
    image_url: cover,
    rating: info.averageRating || 0,
    vote_count: info.ratingsCount || 0,
  };
}

// --- Open Library Lookup ---

async function lookupOnOpenLibrary(title: string, author: string | null): Promise<{
  external_id: string;
  description: string;
  genres: string[];
  year: number | null;
  image_url: string | null;
  rating: number;
  vote_count: number;
} | null> {
  const query = author ? `${title} ${author}` : title;
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1&fields=key,title,first_publish_year,subject,cover_edition_key,ratings_average,ratings_count`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const doc = data.docs?.[0];
  if (!doc) return null;

  const coverKey = doc.cover_edition_key;
  const coverUrl = coverKey ? `https://covers.openlibrary.org/b/olid/${coverKey}-M.jpg` : null;

  return {
    external_id: doc.key,
    description: '',
    genres: (doc.subject || []).filter((s: string) => s.length < 30).slice(0, 5),
    year: doc.first_publish_year || null,
    image_url: coverUrl,
    rating: doc.ratings_average || 0,
    vote_count: doc.ratings_count || 0,
  };
}

// --- TMDB Lookup (movies/TV) ---

async function lookupOnTMDB(title: string, type: 'movie' | 'tv'): Promise<{
  external_id: string;
  description: string;
  genres: string[];
  year: number | null;
  image_url: string | null;
  rating: number;
  vote_count: number;
  creator: string | null;
} | null> {
  const TMDB_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_KEY) return null;

  const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const item = data.results?.[0];
  if (!item) return null;

  const MOVIE_GENRES: Record<number, string> = {28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Science Fiction',53:'Thriller',10752:'War',37:'Western'};
  const TV_GENRES: Record<number, string> = {10759:'Action & Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',9648:'Mystery',10765:'Sci-Fi & Fantasy',10768:'War & Politics',37:'Western'};
  const genreMap = type === 'movie' ? MOVIE_GENRES : TV_GENRES;

  return {
    external_id: String(item.id),
    description: item.overview || '',
    genres: (item.genre_ids || []).map((id: number) => genreMap[id]).filter(Boolean),
    year: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).slice(0, 4)) : null,
    image_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    rating: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    creator: null,
  };
}

// --- Spotify Lookup (music/podcasts) ---

let spotifyToken: { token: string; exp: number } | null = null;
async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyToken.exp) return spotifyToken.token;
  const { Buffer } = require('buffer');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64') },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  spotifyToken = { token: data.access_token, exp: Date.now() + 3500000 };
  return spotifyToken.token;
}

async function lookupOnSpotify(name: string, type: 'artist' | 'show'): Promise<{
  external_id: string;
  description: string;
  genres: string[];
  image_url: string | null;
  metadata: Record<string, unknown>;
} | null> {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=${type}&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();

  if (type === 'artist') {
    const artist = data.artists?.items?.[0];
    if (!artist) return null;
    const image = artist.images?.sort((a: {width:number}, b: {width:number}) => b.width - a.width)[0];
    return {
      external_id: artist.id,
      description: (artist.genres || []).slice(0, 3).join(', ') || 'Artist',
      genres: (artist.genres || []).slice(0, 5),
      image_url: image?.url || null,
      metadata: { spotify_popularity: artist.popularity || 0 },
    };
  } else {
    const show = data.shows?.items?.[0];
    if (!show) return null;
    const image = show.images?.sort((a: {width:number}, b: {width:number}) => b.width - a.width)[0];
    return {
      external_id: show.id,
      description: show.description || '',
      genres: [],
      image_url: image?.url || null,
      metadata: { total_episodes: show.total_episodes, publisher: show.publisher },
    };
  }
}

// --- Main Seeding Logic ---

async function seedCategory(category: string, prompts: string[]) {
  let totalInserted = 0, totalSkipped = 0, totalFailed = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(`\n[${i + 1}/${prompts.length}] Generating: ${prompt.slice(0, 60)}...`);

    let titles: { title: string; creator: string }[];
    try {
      titles = await generateTitleList(category, prompt);
    } catch (err) {
      console.error('  LLM error:', (err as Error).message);
      continue;
    }

    console.log(`  Got ${titles.length} titles. Looking up metadata...`);

    for (const item of titles) {
      if (!item.title) continue;

      // Check if already exists
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .ilike('title', item.title)
        .in('category', category === 'books' ? ['books', 'fiction_books', 'nonfiction_books'] : [category])
        .limit(1);

      if (existing && existing.length > 0) { totalSkipped++; continue; }

      // Lookup metadata
      let metadata: { external_id: string; description: string; genres: string[]; year: number | null; image_url: string | null; rating?: number; vote_count?: number; creator?: string | null; metadata?: Record<string, unknown> } | null = null;

      if (category === 'books') {
        metadata = await lookupBookOnGoogleBooks(item.title, item.creator);
        if (!metadata) metadata = await lookupOnOpenLibrary(item.title, item.creator);
      } else if (category === 'movies') {
        metadata = await lookupOnTMDB(item.title, 'movie');
      } else if (category === 'tv_shows') {
        metadata = await lookupOnTMDB(item.title, 'tv');
      } else if (category === 'music_artists') {
        const spotify = await lookupOnSpotify(item.title, 'artist');
        if (spotify) metadata = { ...spotify, year: null, rating: 0, vote_count: 0 };
      } else if (category === 'podcasts') {
        const spotify = await lookupOnSpotify(item.title, 'show');
        if (spotify) metadata = { ...spotify, year: null, rating: 0, vote_count: 0 };
      }

      if (!metadata) {
        // Insert with just LLM data
        const { error } = await supabase.from('items').insert({
          category,
          external_id: `llm_${item.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 60)}`,
          external_source: 'llm_seed',
          title: item.title,
          creator: item.creator || null,
          description: '',
          genres: [],
          year: null,
          image_url: null,
          metadata: {},
        });
        if (!error) totalInserted++;
        else totalFailed++;
        continue;
      }

      const { error } = await supabase.from('items').insert({
        category,
        external_id: metadata.external_id,
        external_source: category === 'books' ? 'google_books' : category === 'movies' || category === 'tv_shows' ? 'tmdb' : 'spotify',
        title: item.title,
        creator: metadata.creator !== undefined ? metadata.creator : item.creator || null,
        description: metadata.description || '',
        genres: metadata.genres || [],
        year: metadata.year,
        image_url: metadata.image_url,
        metadata: {
          ...(metadata.metadata || {}),
          ...(category === 'books' ? { google_rating: metadata.rating, google_vote_count: metadata.vote_count } : {}),
          ...(category === 'movies' || category === 'tv_shows' ? { tmdb_rating: metadata.rating, tmdb_vote_count: metadata.vote_count } : {}),
        },
      });

      if (!error) totalInserted++;
      else totalFailed++;

      process.stdout.write(`\r  ${totalInserted} inserted, ${totalSkipped} skipped, ${totalFailed} failed`);
    }
  }

  console.log(`\n\n${category} done: ${totalInserted} inserted, ${totalSkipped} skipped, ${totalFailed} failed`);
}

// --- Prompts ---

const BOOK_PROMPTS = [
  'List 100 of the best-selling fiction novels of all time. Include classics and modern bestsellers. Mix of genres.',
  'List 100 of the most acclaimed literary fiction novels. Include Booker, Pulitzer, Nobel winners.',
  'List 100 of the best thriller and mystery novels of all time.',
  'List 100 of the best science fiction and fantasy novels of all time.',
  'List 100 of the best non-fiction books of all time. Mix of science, history, biography, philosophy, psychology.',
  'List 100 popular self-help, business, and personal development books.',
  'List 100 popular romance, young adult, and contemporary fiction novels from 2010-2025.',
  'List 100 popular books from BookTok, Reese\'s Book Club, and Oprah\'s Book Club.',
  'List 100 best true crime, memoir, and biography books.',
  'List 100 best horror, dystopian, and dark fiction novels.',
];

const MOVIE_PROMPTS = [
  'List 100 of the highest-grossing movies of all time.',
  'List 100 of the most critically acclaimed movies of all time. Include Oscar, Cannes, Venice winners.',
  'List 100 of the best action and adventure movies of all time.',
  'List 100 of the best comedy movies of all time.',
  'List 100 of the best horror and thriller movies of all time.',
  'List 100 of the best animated movies of all time, including Pixar, Disney, Studio Ghibli, and others.',
  'List 100 of the best drama and romance movies of all time.',
  'List 100 of the best science fiction movies of all time.',
  'List 100 popular movies from 2020-2025.',
  'List 100 of the best foreign language and independent films of all time.',
];

const TV_PROMPTS = [
  'List 100 of the most popular TV shows of all time across all genres.',
  'List 100 of the best prestige drama TV shows of all time.',
  'List 100 of the best comedy TV shows of all time, including sitcoms.',
  'List 100 of the best sci-fi, fantasy, and supernatural TV shows.',
  'List 100 of the best crime, thriller, and mystery TV shows.',
  'List 100 of the best reality, documentary, and competition TV shows.',
  'List 100 popular TV shows from 2020-2025.',
  'List 100 of the best animated TV shows of all time, including anime.',
];

const MUSIC_PROMPTS = [
  'List 100 of the most iconic and legendary music artists of all time across all genres.',
  'List 100 of the most popular current music artists (2020-2025).',
  'List 100 of the best indie, alternative, and underground music artists.',
  'List 100 of the best hip-hop, R&B, and soul artists of all time.',
  'List 100 of the best rock, metal, and punk artists of all time.',
  'List 100 of the best electronic, dance, and ambient music artists.',
];

const PODCAST_PROMPTS = [
  'List 100 of the most popular podcasts of all time across all categories.',
  'List 100 of the best true crime and investigative podcasts.',
  'List 100 of the best educational, science, history, and business podcasts.',
  'List 100 of the best comedy, interview, and entertainment podcasts.',
];

async function main() {
  const category = process.argv[2] || 'books';

  const promptMap: Record<string, string[]> = {
    books: BOOK_PROMPTS,
    movies: MOVIE_PROMPTS,
    tv_shows: TV_PROMPTS,
    music_artists: MUSIC_PROMPTS,
    podcasts: PODCAST_PROMPTS,
  };

  const prompts = promptMap[category];
  if (!prompts) {
    console.error('Unknown category:', category);
    return;
  }

  console.log(`Seeding ${category} via LLM title generation + metadata lookup...\n`);
  await seedCategory(category, prompts);
}

main().catch(console.error);
