/* eslint-disable @typescript-eslint/no-require-imports */
// Round 3: Target specific gaps with unique prompts
const { createClient } = require('@supabase/supabase-js');
const { Buffer } = require('buffer');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const TMDB_KEY = process.env.TMDB_API_KEY;
const GOOGLE_BOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY;

async function generateTitles(prompt: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Return a JSON object with an "items" array of objects with "title" and "creator" fields. Return exactly 100 items. Well-known, popular items only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  if (Array.isArray(parsed)) return parsed;
  const arr = Object.values(parsed).find((v) => Array.isArray(v));
  return (arr as { title: string; creator: string }[]) || [];
}

async function lookupTMDB(title: string, type: 'movie' | 'tv') {
  if (!TMDB_KEY) return null;
  const res = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&page=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.results?.[0];
  if (!item) return null;
  return {
    external_id: String(item.id), description: item.overview || '',
    year: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).slice(0, 4)) : null,
    image_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    rating: item.vote_average || 0, vote_count: item.vote_count || 0,
  };
}

async function lookupGoogleBooks(title: string, author: string | null) {
  if (!GOOGLE_BOOKS_KEY) return null;
  const q = author ? `${title} ${author}` : title;
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?key=${GOOGLE_BOOKS_KEY}&q=${encodeURIComponent(q)}&maxResults=1&langRestrict=en`);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  const info = item.volumeInfo || {};
  return {
    external_id: item.id, description: info.description || '',
    genres: info.categories || [],
    year: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null,
    image_url: info.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
    rating: info.averageRating || 0, vote_count: info.ratingsCount || 0,
  };
}

let spotifyToken: { token: string; exp: number } | null = null;
async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyToken.exp) return spotifyToken.token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64') },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  spotifyToken = { token: data.access_token, exp: Date.now() + 3500000 };
  return spotifyToken.token;
}

async function lookupSpotify(name: string, type: 'artist' | 'show') {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=${type}&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const item = type === 'artist' ? data.artists?.items?.[0] : data.shows?.items?.[0];
  if (!item) return null;
  const image = item.images?.sort((a: {width:number}, b: {width:number}) => b.width - a.width)[0];
  return { external_id: item.id, image_url: image?.url || null, description: type === 'artist' ? ((item.genres||[]).slice(0,3).join(', ')||'Artist') : (item.description||''), genres: type === 'artist' ? (item.genres||[]).slice(0,5) : [], metadata: type === 'artist' ? { spotify_popularity: item.popularity||0 } : { total_episodes: item.total_episodes } };
}

async function seedBatch(category: string, prompts: string[]) {
  let totalInserted = 0, totalSkipped = 0;

  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n[${i+1}/${prompts.length}] ${prompts[i].slice(0, 70)}...`);
    try {
      const titles = await generateTitles(prompts[i]);
      console.log(`  Got ${titles.length} titles`);

      for (const item of titles) {
        if (!item.title) continue;
        const cats = category === 'books' ? ['books','fiction_books','nonfiction_books'] : [category];
        const { data: existing } = await supabase.from('items').select('id').ilike('title', item.title).in('category', cats).limit(1);
        if (existing && existing.length > 0) { totalSkipped++; continue; }

        let meta: any = null;
        if (category === 'movies') meta = await lookupTMDB(item.title, 'movie');
        else if (category === 'tv_shows') meta = await lookupTMDB(item.title, 'tv');
        else if (category === 'books') meta = await lookupGoogleBooks(item.title, item.creator);
        else if (category === 'music_artists') meta = await lookupSpotify(item.title, 'artist');
        else if (category === 'podcasts') meta = await lookupSpotify(item.title, 'show');

        const source = meta ? (category === 'books' ? 'google_books' : ['movies','tv_shows'].includes(category) ? 'tmdb' : 'spotify') : 'llm_seed';
        const extId = meta?.external_id || `llm_${item.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 60)}`;

        await supabase.from('items').insert({
          category, external_id: extId, external_source: source,
          title: item.title, creator: item.creator || null,
          description: meta?.description || '', genres: meta?.genres || [],
          year: meta?.year || null, image_url: meta?.image_url || null,
          metadata: { ...(meta?.metadata || {}), tmdb_rating: meta?.rating, tmdb_vote_count: meta?.vote_count, google_rating: category === 'books' ? meta?.rating : undefined },
        });
        totalInserted++;
        process.stdout.write(`\r  ${totalInserted} inserted, ${totalSkipped} skipped`);
      }
    } catch (e: any) { console.error(`  Error: ${e.message}`); }
  }
  console.log(`\n\n${category} done: ${totalInserted} inserted, ${totalSkipped} skipped`);
}

async function main() {
  const category = process.argv[2] || 'all';

  if (category === 'all' || category === 'music_artists') {
    await seedBatch('music_artists', [
      'List 100 iconic Australian music artists and bands',
      'List 100 best K-pop, J-pop, and Asian music artists',
      'List 100 best jazz and blues artists of all time',
      'List 100 best country and Americana artists',
      'List 100 best electronic, house, and techno DJs and producers',
      'List 100 best classical composers and performers',
      'List 100 best Latin, reggaeton, and Afrobeats artists',
      'List 100 best singer-songwriters of all time',
      'List 100 best 80s and 90s pop and rock artists',
      'List 100 breakthrough music artists of 2023-2025',
    ]);
  }

  if (category === 'all' || category === 'podcasts') {
    await seedBatch('podcasts', [
      'List 100 most popular Australian podcasts',
      'List 100 best British and UK podcasts',
      'List 100 best business and entrepreneurship podcasts',
      'List 100 best health, fitness, and wellness podcasts',
      'List 100 best science and technology podcasts',
      'List 100 best relationship and parenting podcasts',
      'List 100 best sports podcasts across all sports',
      'List 100 best narrative and investigative journalism podcasts',
    ]);
  }

  if (category === 'all' || category === 'books') {
    await seedBatch('books', [
      'List 100 best Australian novels and non-fiction books',
      'List 100 best graphic novels and manga series',
      'List 100 best children and middle-grade books of all time',
      'List 100 best cookbooks and food writing books',
      'List 100 best sports books and sports biographies',
      'List 100 best war and military history books',
      'List 100 best books about money, investing, and economics',
      'List 100 best travel writing and adventure books',
    ]);
  }

  if (category === 'all' || category === 'movies') {
    await seedBatch('movies', [
      'List 100 best Australian films of all time',
      'List 100 best Bollywood and Indian films',
      'List 100 best Korean, Japanese, and Asian films',
      'List 100 best documentary films of all time',
      'List 100 best family and kids movies of all time',
      'List 100 best war movies of all time',
      'List 100 best sports movies of all time',
      'List 100 best romantic comedies of all time',
    ]);
  }

  if (category === 'all' || category === 'tv_shows') {
    await seedBatch('tv_shows', [
      'List 100 best Australian TV shows of all time',
      'List 100 best British TV shows of all time',
      'List 100 best Korean dramas (K-dramas)',
      'List 100 best anime series of all time',
      'List 100 best reality TV and competition shows',
      'List 100 best kids and family TV shows',
    ]);
  }
}

main().catch(console.error);
