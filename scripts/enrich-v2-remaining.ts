/* eslint-disable @typescript-eslint/no-require-imports */
// Only re-enriches items that have OLD schema tags (no emotional_tone field)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const PROMPTS: Record<string, string> = {
  movies: `You are a film analyst. Return JSON: {"emotional_tone":["euphoric","warm","melancholy","tense","dark","playful","serene","inspiring","irreverent","unsettling","bittersweet","nostalgic","anxious","triumphant","contemplative"],"complexity":1-5,"pacing":"slow|measured|moderate|brisk|relentless","darkness_intensity":"light|moderate|dark|very_dark|extreme","character_moral_complexity":"likable|flawed|antihero|repellent|mixed","primary_engagement":"emotional|intellectual|visceral|fun|mixed","storytelling_vehicle":"dialogue_driven|visual_storytelling|action_driven|balanced","tonal_consistency":"pure_tone|some_mixing|wild_shifts","protagonist_likability":"highly_likable|relatable|complex|difficult|repellent","resolution_style":"neat_closure|mostly_resolved|ambiguous|open_ended|devastating","scale":"intimate|mid_range|epic|grand_spectacle","originality":"wholly_original|fresh_take|familiar_well_executed|formulaic","sub_genres":[],"themes":[],"content_warnings":[],"special_tags":[]}. Be precise. Valid JSON only.`,
  tv_shows: `You are a TV analyst. Return JSON: {"emotional_tone":[],"complexity":1-5,"pacing":"slow|measured|moderate|brisk|relentless","darkness_intensity":"light|moderate|dark|very_dark|extreme","serialization":"episodic|hybrid|serialized|anthology","character_moral_complexity":"likable|flawed|antihero|repellent|mixed","primary_engagement":"emotional|intellectual|visceral|fun|mixed","comfort_rewatch_quotient":"high|medium|low","burn_speed":"instant_hook|steady_build|slow_burn|very_slow_burn","protagonist_likability":"highly_likable|relatable|complex|difficult|repellent","humor_integration":"comedy_first|humor_throughout|occasional_levity|serious|dark_humor","commitment_level":"limited_single_season|short_2_3_seasons|medium_4_6_seasons|long_running","sub_genres":[],"themes":[],"content_warnings":[],"special_tags":[]}. Valid JSON only.`,
  books: `You are a literary analyst. Return JSON: {"emotional_tone":[],"complexity":1-5,"pacing":"slow|measured|moderate|brisk|relentless","darkness_intensity":"light|moderate|dark|very_dark|extreme","prose_style_density":"sparse|balanced|lush|ornate","prose_style_accessibility":"accessible|moderate|literary|experimental","character_moral_complexity":"likable|flawed|antihero|repellent|mixed|not_applicable","primary_engagement":"emotional|intellectual|visceral|fun|mixed","reading_purpose":"escapism|emotional_experience|intellectual_stimulation|self_improvement|aesthetic_pleasure","length_category":"short_under_250|medium_250_400|long_400_600|epic_over_600","is_series":boolean,"is_fiction":boolean,"protagonist_likability":"highly_likable|relatable|complex|difficult|repellent|not_applicable","resolution_style":"neat_closure|mostly_resolved|ambiguous|open_ended|devastating|not_applicable","internal_monologue_level":"minimal|moderate|heavy|stream_of_consciousness","sub_genres":[],"themes":[],"content_warnings":[],"special_tags":[],"nonfiction_type":null or string,"nonfiction_depth":null or string}. Valid JSON only.`,
};

async function enrichItem(title: string, creator: string|null, genres: string[], year: number|null, desc: string|null, category: string) {
  const cat = ['fiction_books','nonfiction_books'].includes(category) ? 'books' : category;
  const prompt = PROMPTS[cat];
  if (!prompt) return null;
  const info = [title, creator ? `by ${creator}` : null, year ? `(${year})` : null, genres.length ? genres.join(', ') : null, desc ? desc.slice(0,200) : null].filter(Boolean).join(' — ');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: prompt }, { role: 'user', content: info }], temperature: 0.3, response_format: { type: 'json_object' } }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  const category = process.argv[2] || 'movies';
  const cats = category === 'books' ? ['books','fiction_books','nonfiction_books'] : [category];
  const batchSize = 1000;
  let enriched = 0, errors = 0, skipped = 0;
  let offset = 0;
  let hasMore = true;

  console.log(`Re-enriching ${category} (old schema only)...\n`);

  while (hasMore) {
    const { data: items } = await supabase.from('items').select('id, title, creator, genres, year, description, category, metadata').in('category', cats).range(offset, offset + batchSize - 1);
    if (!items || items.length === 0) { hasMore = false; break; }

    for (const item of items) {
      const tags = (item.metadata as Record<string, unknown>)?.tags as Record<string, unknown> | undefined;
      // Skip if already has new schema (emotional_tone) or no tags at all (will be caught by regular enrich)
      if (tags?.emotional_tone) { skipped++; continue; }
      if (!tags) { skipped++; continue; }

      try {
        const newTags = await enrichItem(item.title, item.creator, item.genres || [], item.year, item.description, item.category);
        if (newTags) {
          await supabase.from('items').update({ metadata: { ...(item.metadata as Record<string, unknown>), tags: newTags } }).eq('id', item.id);
          enriched++;
          process.stdout.write(`\r${enriched} enriched (${errors} errors, ${skipped} skipped) — ${item.title}`);
        }
      } catch { errors++; }
    }

    offset += batchSize;
    if (items.length < batchSize) hasMore = false;
  }

  console.log(`\n\nDone: ${enriched} enriched, ${errors} errors, ${skipped} skipped`);
}

main().catch(console.error);
