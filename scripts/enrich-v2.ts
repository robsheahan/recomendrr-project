/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

interface ItemRow {
  id: string;
  title: string;
  creator: string | null;
  genres: string[];
  year: number | null;
  description: string | null;
  category: string;
  metadata: Record<string, unknown> | null;
}

// Category-specific prompts imported inline to avoid TS module issues
const PROMPTS: Record<string, string> = {
  movies: `You are a film analyst. Given a movie's details, provide precise taste-dimension tags.

Return JSON:
{
  "emotional_tone": ["euphoric","warm","melancholy","tense","dark","playful","serene","inspiring","irreverent","unsettling","bittersweet","nostalgic","anxious","triumphant","contemplative"],
  "complexity": 1-5,
  "pacing": "slow|measured|moderate|brisk|relentless",
  "darkness_intensity": "light|moderate|dark|very_dark|extreme",
  "character_moral_complexity": "likable|flawed|antihero|repellent|mixed",
  "primary_engagement": "emotional|intellectual|visceral|fun|mixed",
  "storytelling_vehicle": "dialogue_driven|visual_storytelling|action_driven|balanced",
  "tonal_consistency": "pure_tone|some_mixing|wild_shifts",
  "protagonist_likability": "highly_likable|relatable|complex|difficult|repellent",
  "resolution_style": "neat_closure|mostly_resolved|ambiguous|open_ended|devastating",
  "scale": "intimate|mid_range|epic|grand_spectacle",
  "originality": "wholly_original|fresh_take|familiar_well_executed|formulaic",
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes"],
  "content_warnings": ["graphic_violence|gore|sexual_content|disturbing_imagery|drug_use|none"],
  "special_tags": ["ends_with_twist","based_on_true_story","cult_classic","visually_stunning","mind_bending","feel_good","tear_jerker","franchise","sequel","animated","foreign_language","award_winner","director_driven","crowd_pleaser","underrated","comfort_watch"]
}
Be precise with emotional_tone. Only include tags that genuinely apply. Return valid JSON only.`,

  tv_shows: `You are a TV analyst. Given a show's details, provide precise taste-dimension tags.

Return JSON:
{
  "emotional_tone": ["euphoric","warm","melancholy","tense","dark","playful","serene","inspiring","irreverent","unsettling","bittersweet","nostalgic","anxious","triumphant","contemplative"],
  "complexity": 1-5,
  "pacing": "slow|measured|moderate|brisk|relentless",
  "darkness_intensity": "light|moderate|dark|very_dark|extreme",
  "serialization": "episodic|hybrid|serialized|anthology",
  "character_moral_complexity": "likable|flawed|antihero|repellent|mixed",
  "primary_engagement": "emotional|intellectual|visceral|fun|mixed",
  "comfort_rewatch_quotient": "high|medium|low",
  "burn_speed": "instant_hook|steady_build|slow_burn|very_slow_burn",
  "protagonist_likability": "highly_likable|relatable|complex|difficult|repellent",
  "humor_integration": "comedy_first|humor_throughout|occasional_levity|serious|dark_humor",
  "commitment_level": "limited_single_season|short_2_3_seasons|medium_4_6_seasons|long_running",
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes"],
  "content_warnings": ["graphic_violence|gore|sexual_content|disturbing_imagery|drug_use|none"],
  "special_tags": ["binge_worthy","comfort_show","prestige","procedural","reality_based","animated","foreign_language","cult_classic","perfect_ending","controversial_ending","cancelled_too_soon","ensemble_cast"]
}
Return valid JSON only.`,

  books: `You are a literary analyst. Given a book's details, provide precise taste-dimension tags.

Return JSON:
{
  "emotional_tone": ["euphoric","warm","melancholy","tense","dark","playful","serene","inspiring","irreverent","unsettling","bittersweet","nostalgic","anxious","triumphant","contemplative","haunting"],
  "complexity": 1-5,
  "pacing": "slow|measured|moderate|brisk|relentless",
  "darkness_intensity": "light|moderate|dark|very_dark|extreme",
  "prose_style_density": "sparse|balanced|lush|ornate",
  "prose_style_accessibility": "accessible|moderate|literary|experimental",
  "character_moral_complexity": "likable|flawed|antihero|repellent|mixed|not_applicable",
  "primary_engagement": "emotional|intellectual|visceral|fun|mixed",
  "reading_purpose": "escapism|emotional_experience|intellectual_stimulation|self_improvement|aesthetic_pleasure",
  "length_category": "short_under_250|medium_250_400|long_400_600|epic_over_600",
  "is_series": true/false,
  "is_fiction": true/false,
  "protagonist_likability": "highly_likable|relatable|complex|difficult|repellent|not_applicable",
  "resolution_style": "neat_closure|mostly_resolved|ambiguous|open_ended|devastating|not_applicable",
  "internal_monologue_level": "minimal|moderate|heavy|stream_of_consciousness",
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes"],
  "content_warnings": ["graphic_violence|sexual_content|disturbing_content|heavy_themes|none"],
  "special_tags": ["page_turner","twist_ending","unreliable_narrator","award_winner","classic","modern_classic","translated","beautiful_prose","thought_provoking","comfort_read","debut_novel","book_club_pick","multiple_pov"],
  "nonfiction_type": "narrative|idea_driven|practical|academic|memoir|investigative" or null,
  "nonfiction_depth": "popular_accessible|moderate|deep_rigorous" or null
}
Return valid JSON only.`,

  music_artists: `You are a music analyst. Given an artist's details, provide precise taste-dimension tags.

Return JSON:
{
  "energy_intensity": "ambient|low|medium|high|extreme|varied",
  "sonic_texture_organic": "fully_organic|mostly_organic|hybrid|mostly_electronic|fully_electronic",
  "sonic_texture_production": "raw_lo_fi|natural|balanced|polished|hyper_produced",
  "sonic_density": "minimal_sparse|moderate|dense_layered|maximalist",
  "vocal_style": "clean_melodic|raw_textured|rap_spoken|screamed_harsh|instrumental_only|varied",
  "vocal_prominence": "instrumental_dominant|balanced|vocal_dominant",
  "lyrical_depth": "none_instrumental|surface_party|narrative_storytelling|emotional_confessional|poetic_literary|political_social",
  "emotional_tone": ["euphoric","melancholy","aggressive","serene","dark","playful","romantic","anxious","triumphant","nostalgic","dreamy","intense","peaceful","rebellious"],
  "complexity": 1-5,
  "harmonic_sophistication": "simple_pop|moderate|sophisticated|jazz_level|experimental",
  "rhythmic_character": "steady_driving|groovy_syncopated|complex_shifting|ambient_free|varied",
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes"],
  "special_tags": ["iconic","legendary","genre_defining","genre_bending","great_live_act","prolific","critically_acclaimed","underground_hero","influential","singer_songwriter"]
}
Return valid JSON only.`,

  podcasts: `You are a podcast analyst. Given a podcast's details, provide precise taste-dimension tags.

Return JSON:
{
  "podcast_format": "narrative_produced|conversational_interview|solo_commentary|panel_roundtable|educational_lecture|fiction_audio_drama|mixed",
  "subject_domain": ["current_events","technology","business","science","history","true_crime","comedy","culture","health","sports","personal_development","storytelling","politics","finance","gaming","relationships","philosophy","nature"],
  "host_style": "formal_authoritative|casual_warm|comedic_irreverent|provocative_challenging|academic_expert|journalistic",
  "information_density": "high|medium|low",
  "production_quality": "high_cinematic|good|moderate|lo_fi_authentic",
  "emotional_tone": ["serious","light","inspiring","dark","playful","intimate","intense","educational","entertaining","provocative"],
  "complexity": 1-5,
  "episode_length_category": "short_under_30|medium_30_60|long_60_120|marathon_over_120",
  "host_count": "solo|duo|panel|rotating|varied",
  "serialization": "fully_serialized|loosely_serialized|standalone_episodes|mixed",
  "currency": "current_events_focused|mixed|evergreen_timeless",
  "content_warnings": ["explicit_language|violent_content|heavy_themes|none"],
  "special_tags": ["binge_worthy","great_for_commutes","award_winning","celebrity_host","expert_host","investigative","feel_good","addictive","educational","thought_provoking"]
}
Return valid JSON only.`,
};

async function enrichItem(item: ItemRow) {
  const cat = ['fiction_books', 'nonfiction_books'].includes(item.category) ? 'books' : item.category;
  const prompt = PROMPTS[cat];
  if (!prompt) return null;

  const info = [
    `Title: ${item.title}`,
    item.creator ? `Creator: ${item.creator}` : null,
    item.year ? `Year: ${item.year}` : null,
    item.genres?.length > 0 ? `Genres: ${item.genres.join(', ')}` : null,
    item.description ? `Description: ${item.description.slice(0, 300)}` : null,
    `Category: ${item.category}`,
  ].filter(Boolean).join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: info },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  const category = process.argv[2] || 'movies';
  const forceReenrich = process.argv.includes('--force');
  const batchSize = 500;

  const categoryFilter = category === 'books'
    ? ['books', 'fiction_books', 'nonfiction_books']
    : category === 'all'
      ? ['movies', 'tv_shows', 'books', 'fiction_books', 'nonfiction_books', 'music_artists', 'podcasts']
      : [category];

  console.log(`Enriching ${category}${forceReenrich ? ' (FORCE RE-ENRICH)' : ''}...\n`);

  let totalEnriched = 0, totalErrors = 0, totalSkipped = 0;
  let hasMore = true;
  let offset = 0;

  while (hasMore) {
    const { data: items, error } = await supabase
      .from('items')
      .select('id, title, creator, genres, year, description, category, metadata')
      .in('category', categoryFilter)
      .range(offset, offset + batchSize - 1);

    if (error || !items || items.length === 0) {
      hasMore = false;
      break;
    }

    const toEnrich = (items as ItemRow[]).filter((item) => {
      if (forceReenrich) return true;
      const meta = item.metadata || {};
      return !meta.tags;
    });

    if (toEnrich.length === 0) {
      offset += batchSize;
      totalSkipped += items.length;
      if (items.length < batchSize) hasMore = false;
      continue;
    }

    for (const item of toEnrich) {
      try {
        const tags = await enrichItem(item);
        if (tags) {
          const metadata = (item.metadata || {}) as Record<string, unknown>;
          await supabase
            .from('items')
            .update({ metadata: { ...metadata, tags } })
            .eq('id', item.id);
          totalEnriched++;
          process.stdout.write(`\r${totalEnriched} enriched (${totalErrors} errors, ${totalSkipped} skipped) — ${item.title}`);
        } else {
          totalErrors++;
        }
      } catch {
        totalErrors++;
      }
    }

    offset += batchSize;
    if (items.length < batchSize) hasMore = false;
  }

  console.log(`\n\nDone: ${totalEnriched} enriched, ${totalErrors} errors, ${totalSkipped} skipped`);
}

main().catch(console.error);
