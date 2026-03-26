/* eslint-disable @typescript-eslint/no-require-imports */
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
        { role: 'system', content: 'Return a JSON object with an "items" array of objects with "title" and "creator" fields. Return exactly 100 items. Well-known items that real people search for.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
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
  return { external_id: String(item.id), description: item.overview || '', year: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).slice(0, 4)) : null, image_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null, rating: item.vote_average || 0, vote_count: item.vote_count || 0 };
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
  return { external_id: item.id, description: info.description || '', genres: info.categories || [], year: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null, image_url: info.imageLinks?.thumbnail?.replace('http://', 'https://') || null, rating: info.averageRating || 0, vote_count: info.ratingsCount || 0 };
}

let spotifyToken: { token: string; exp: number } | null = null;
async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyToken.exp) return spotifyToken.token;
  const res = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64') }, body: 'grant_type=client_credentials' });
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
        const extId = meta?.external_id || `llm3_${item.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 60)}`;
        await supabase.from('items').insert({ category, external_id: extId, external_source: source, title: item.title, creator: item.creator || null, description: meta?.description || '', genres: meta?.genres || [], year: meta?.year || null, image_url: meta?.image_url || null, metadata: { ...(meta?.metadata || {}), tmdb_rating: meta?.rating, tmdb_vote_count: meta?.vote_count, google_rating: category === 'books' ? meta?.rating : undefined } });
        totalInserted++;
        process.stdout.write(`\r  ${totalInserted} ins, ${totalSkipped} skip`);
      }
    } catch (e: any) { console.error(`  Error: ${e.message}`); }
  }
  console.log(`\n${category} done: ${totalInserted} inserted, ${totalSkipped} skipped`);
}

async function main() {
  const cat = process.argv[2] || 'all';

  if (cat === 'all' || cat === 'movies') {
    await seedBatch('movies', [
      'List 100 best European films — French, Italian, Spanish, German, Scandinavian cinema',
      'List 100 best cult movies of all time',
      'List 100 best martial arts and kung fu movies',
      'List 100 best Christmas and holiday movies',
      'List 100 best movies of the 1990s',
      'List 100 best movies of the 1980s',
      'List 100 best movies of the 2010s',
      'List 100 best heist and caper movies',
      'List 100 best disaster and survival movies',
      'List 100 best legal and courtroom drama movies',
      'List 100 best coming-of-age movies',
      'List 100 best music and concert movies and biopics',
    ]);
  }

  if (cat === 'all' || cat === 'tv_shows') {
    await seedBatch('tv_shows', [
      'List 100 best medical and hospital TV shows',
      'List 100 best legal and courtroom TV shows',
      'List 100 best spy and espionage TV shows',
      'List 100 best limited series and miniseries of all time',
      'List 100 best TV shows of the 2020s so far',
      'List 100 best cooking and food TV shows',
      'List 100 best documentary series of all time',
      'List 100 best teen and young adult TV shows',
      'List 100 best workplace comedy TV shows',
      'List 100 best European TV shows — Scandi noir, Spanish, French, German',
    ]);
  }

  if (cat === 'all' || cat === 'books') {
    await seedBatch('books', [
      'List 100 best debut novels of the last 20 years',
      'List 100 best books about science and nature',
      'List 100 best books about technology, AI, and the future',
      'List 100 best short story collections and novellas',
      'List 100 best translated novels from around the world',
      'List 100 best books about music, art, and creativity',
      'List 100 best books about relationships and human behaviour',
      'List 100 best young adult and new adult novels',
      'List 100 best cozy mysteries and light crime fiction',
      'List 100 best books about leadership, strategy, and decision-making',
    ]);
  }

  if (cat === 'all' || cat === 'music_artists') {
    await seedBatch('music_artists', [
      'List 100 best New Zealand music artists and bands',
      'List 100 best African music artists — Afrobeats, Afropop, African jazz',
      'List 100 best ambient, new age, and meditation music artists',
      'List 100 best Christian and gospel music artists',
      'List 100 best ska, reggae, and dub artists',
      'List 100 best post-punk, darkwave, and goth artists',
      'List 100 best progressive rock and art rock artists',
      'List 100 best female solo artists of all time',
      'List 100 best male solo artists of all time',
      'List 100 best musical duos and partnerships',
    ]);
  }

  if (cat === 'all' || cat === 'podcasts') {
    await seedBatch('podcasts', [
      'List 100 best movie and TV review podcasts',
      'List 100 best music podcasts and music discussion shows',
      'List 100 best gaming and esports podcasts',
      'List 100 best food, cooking, and restaurant podcasts',
      'List 100 best travel and adventure podcasts',
      'List 100 best personal finance and money podcasts',
      'List 100 best philosophy, ethics, and deep thinking podcasts',
      'List 100 best celebrity interview and chat show podcasts',
    ]);
  }
}

main().catch(console.error);
