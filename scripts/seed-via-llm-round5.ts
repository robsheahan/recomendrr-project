/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const { Buffer } = require('buffer');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const TMDB_KEY = process.env.TMDB_API_KEY;
const GOOGLE_BOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY;

async function gen(prompt: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'Return JSON {"items":[{"title":"...","creator":"..."}]}. Exactly 100 items. Popular, well-known only.' }, { role: 'user', content: prompt }], temperature: 0.8, response_format: { type: 'json_object' } }) });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = await res.json(); const p = JSON.parse(d.choices[0].message.content);
  if (Array.isArray(p)) return p; const a = Object.values(p).find((v) => Array.isArray(v)); return (a as any[]) || [];
}

async function tmdb(title: string, type: 'movie'|'tv') { if (!TMDB_KEY) return null; const r = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&page=1`); if (!r.ok) return null; const d = await r.json(); const i = d.results?.[0]; if (!i) return null; return { external_id: String(i.id), description: i.overview||'', year: (i.release_date||i.first_air_date)?parseInt((i.release_date||i.first_air_date).slice(0,4)):null, image_url: i.poster_path?`https://image.tmdb.org/t/p/w500${i.poster_path}`:null, rating: i.vote_average||0, vote_count: i.vote_count||0 }; }

async function gbooks(title: string, author: string|null) { if (!GOOGLE_BOOKS_KEY) return null; const r = await fetch(`https://www.googleapis.com/books/v1/volumes?key=${GOOGLE_BOOKS_KEY}&q=${encodeURIComponent(author?`${title} ${author}`:title)}&maxResults=1&langRestrict=en`); if (!r.ok) return null; const d = await r.json(); const i = d.items?.[0]; if (!i) return null; const info = i.volumeInfo||{}; return { external_id: i.id, description: info.description||'', genres: info.categories||[], year: info.publishedDate?parseInt(info.publishedDate.slice(0,4)):null, image_url: info.imageLinks?.thumbnail?.replace('http://','https://')||null, rating: info.averageRating||0, vote_count: info.ratingsCount||0 }; }

let sToken: any = null;
async function sAuth() { if (sToken&&Date.now()<sToken.exp) return sToken.token; const r = await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(process.env.SPOTIFY_CLIENT_ID+':'+process.env.SPOTIFY_CLIENT_SECRET).toString('base64')},body:'grant_type=client_credentials'}); const d = await r.json(); sToken={token:d.access_token,exp:Date.now()+3500000}; return sToken.token; }

async function spotify(name: string, type: 'artist'|'show') { const t = await sAuth(); const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=${type}&limit=1`,{headers:{Authorization:`Bearer ${t}`}}); if (!r.ok) return null; const d = await r.json(); const i = type==='artist'?d.artists?.items?.[0]:d.shows?.items?.[0]; if (!i) return null; const img = i.images?.sort((a:{width:number},b:{width:number})=>b.width-a.width)[0]; return { external_id:i.id, image_url:img?.url||null, description:type==='artist'?((i.genres||[]).slice(0,3).join(', ')||'Artist'):(i.description||''), genres:type==='artist'?(i.genres||[]).slice(0,5):[], metadata:type==='artist'?{spotify_popularity:i.popularity||0}:{total_episodes:i.total_episodes} }; }

async function seed(category: string, prompts: string[]) {
  let ins = 0, skip = 0;
  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n[${i+1}/${prompts.length}] ${prompts[i].slice(0,70)}...`);
    try {
      const titles = await gen(prompts[i]);
      for (const item of titles) {
        if (!item.title) continue;
        const cats = category==='books'?['books','fiction_books','nonfiction_books']:[category];
        const {data:ex} = await supabase.from('items').select('id').ilike('title',item.title).in('category',cats).limit(1);
        if (ex&&ex.length>0) {skip++;continue;}
        let m: any = null;
        if (category==='movies') m=await tmdb(item.title,'movie');
        else if (category==='tv_shows') m=await tmdb(item.title,'tv');
        else if (category==='books') m=await gbooks(item.title,item.creator);
        else if (category==='music_artists') m=await spotify(item.title,'artist');
        else if (category==='podcasts') m=await spotify(item.title,'show');
        const src=m?(category==='books'?'google_books':['movies','tv_shows'].includes(category)?'tmdb':'spotify'):'llm_seed';
        const eid=m?.external_id||`llm4_${item.title.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,60)}`;
        await supabase.from('items').insert({category,external_id:eid,external_source:src,title:item.title,creator:item.creator||null,description:m?.description||'',genres:m?.genres||[],year:m?.year||null,image_url:m?.image_url||null,metadata:{...(m?.metadata||{}),tmdb_rating:m?.rating,tmdb_vote_count:m?.vote_count,google_rating:category==='books'?m?.rating:undefined}});
        ins++;
        process.stdout.write(`\r  ${ins} ins, ${skip} skip`);
      }
    } catch (e:any) {console.error(`  Error: ${e.message}`);}
  }
  console.log(`\n${category} done: ${ins} inserted, ${skip} skipped`);
}

async function main() {
  // MOVIES - decade deep dives + niche genres
  await seed('movies', [
    'List 100 best movies of the 1970s',
    'List 100 best movies of the 2000s decade',
    'List 100 best movies released in 2024 and 2025',
    'List 100 best psychological horror and elevated horror movies',
    'List 100 best political and conspiracy thriller movies',
    'List 100 best biographical drama movies (biopics)',
    'List 100 best road trip and travel adventure movies',
    'List 100 best comedy movies of the 2010s and 2020s',
    'List 100 best stop-motion and claymation animated movies',
    'List 100 best foreign language Oscar-nominated and winning films',
  ]);

  // TV - more specifics
  await seed('tv_shows', [
    'List 100 best TV shows that premiered in 2023 2024 2025',
    'List 100 best true crime and crime documentary TV series',
    'List 100 best sci-fi TV shows including space opera and cyberpunk',
    'List 100 best historical drama TV shows set in real time periods',
    'List 100 best sitcoms of the 2000s 2010s and 2020s',
    'List 100 best TV shows on Netflix original series',
    'List 100 best TV shows on HBO and HBO Max',
    'List 100 best TV shows on Apple TV Plus and Disney Plus',
  ]);

  // BOOKS - deeper niches
  await seed('books', [
    'List 100 best literary fiction novels of the 21st century',
    'List 100 best epic fantasy series and novels',
    'List 100 best hard science fiction novels',
    'List 100 best psychological thriller novels',
    'List 100 best historical romance novels',
    'List 100 best books about the brain, consciousness, and neuroscience',
    'List 100 best books about climate change and the environment',
    'List 100 best comedy and humorous novels and non-fiction',
    'List 100 best audiobooks — books known for excellent narration',
    'List 100 best book club picks from the last 10 years',
  ]);

  // MUSIC - deeper
  await seed('music_artists', [
    'List 100 best British music artists and bands of all time',
    'List 100 best Canadian music artists and bands',
    'List 100 best 70s music artists — disco, funk, rock, punk',
    'List 100 best 2000s music artists — pop, hip-hop, indie, emo',
    'List 100 best female hip-hop and R&B artists',
    'List 100 best worship and contemporary Christian music artists',
    'List 100 best lo-fi, chillhop, and study music artists',
    'List 100 best film score composers and soundtrack artists',
  ]);

  // PODCASTS - deeper
  await seed('podcasts', [
    'List 100 best history and historical documentary podcasts',
    'List 100 best podcasts about psychology and mental health',
    'List 100 best podcasts about politics and current affairs worldwide',
    'List 100 best podcasts about startups, tech, and Silicon Valley',
    'List 100 best educational podcasts for learning new skills',
    'List 100 best fiction and audio drama podcasts',
  ]);
}

main().catch(console.error);
