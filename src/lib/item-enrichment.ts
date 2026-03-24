import { SupabaseClient } from '@supabase/supabase-js';

// --- Universal Tags (all categories) ---
export interface UniversalTags {
  emotional_tone: string[]; // euphoric, warm, melancholy, tense, dark, playful, serene, inspiring, irreverent, unsettling, bittersweet, nostalgic, anxious, triumphant, contemplative
  complexity: number; // 1-5 scale
  pacing: string; // slow, measured, moderate, brisk, relentless
  darkness_intensity: string; // light, moderate, dark, very_dark, extreme
}

// --- Movies Tags ---
export interface MovieTags extends UniversalTags {
  character_moral_complexity: string; // likable, flawed, antihero, repellent, mixed
  primary_engagement: string; // emotional, intellectual, visceral, fun, mixed
  storytelling_vehicle: string; // dialogue_driven, visual_storytelling, action_driven, balanced
  tonal_consistency: string; // pure_tone, some_mixing, wild_shifts
  protagonist_likability: string; // highly_likable, relatable, complex, difficult, repellent
  resolution_style: string; // neat_closure, mostly_resolved, ambiguous, open_ended, devastating
  scale: string; // intimate, mid_range, epic, grand_spectacle
  originality: string; // wholly_original, fresh_take, familiar_well_executed, formulaic
  sub_genres: string[];
  themes: string[];
  content_warnings: string[];
  special_tags: string[]; // ends_with_twist, based_on_true_story, cult_classic, visually_stunning, mind_bending, feel_good, tear_jerker, franchise, sequel, animated, foreign_language, award_winner, director_driven
}

// --- TV Show Tags ---
export interface TVShowTags extends UniversalTags {
  serialization: string; // episodic, hybrid, serialized, anthology
  character_moral_complexity: string;
  primary_engagement: string;
  comfort_rewatch_quotient: string; // high, medium, low
  burn_speed: string; // instant_hook, steady_build, slow_burn, very_slow_burn
  protagonist_likability: string;
  humor_integration: string; // comedy_first, humor_throughout, occasional_levity, serious, dark_humor
  commitment_level: string; // limited_single_season, short_2_3_seasons, medium_4_6_seasons, long_running
  sub_genres: string[];
  themes: string[];
  content_warnings: string[];
  special_tags: string[]; // binge_worthy, comfort_show, prestige, procedural, reality_based, animated, foreign_language, cult_classic, perfect_ending, controversial_ending, cancelled_too_soon, ensemble_cast
}

// --- Book Tags ---
export interface BookTags extends UniversalTags {
  prose_style_density: string; // sparse, balanced, lush, ornate
  prose_style_accessibility: string; // accessible, moderate, literary, experimental
  character_moral_complexity: string;
  primary_engagement: string;
  reading_purpose: string; // escapism, emotional_experience, intellectual_stimulation, self_improvement, aesthetic_pleasure
  length_category: string; // short_under_250, medium_250_400, long_400_600, epic_over_600
  is_series: boolean;
  is_fiction: boolean;
  protagonist_likability: string;
  resolution_style: string;
  internal_monologue_level: string; // minimal, moderate, heavy, stream_of_consciousness
  sub_genres: string[];
  themes: string[];
  content_warnings: string[];
  special_tags: string[]; // page_turner, twist_ending, unreliable_narrator, award_winner, classic, modern_classic, translated, beautiful_prose, thought_provoking, comfort_read, debut_novel, book_club_pick, multiple_pov
  // Non-fiction specific (null for fiction)
  nonfiction_type: string | null; // narrative, idea_driven, practical, academic, memoir, investigative
  nonfiction_depth: string | null; // popular_accessible, moderate, deep_rigorous
}

// --- Music Artist Tags ---
export interface MusicArtistTags {
  energy_intensity: string; // ambient, low, medium, high, extreme, varied
  sonic_texture_organic: string; // fully_organic, mostly_organic, hybrid, mostly_electronic, fully_electronic
  sonic_texture_production: string; // raw_lo_fi, natural, balanced, polished, hyper_produced
  sonic_density: string; // minimal_sparse, moderate, dense_layered, maximalist
  vocal_style: string; // clean_melodic, raw_textured, rap_spoken, screamed_harsh, instrumental_only, varied
  vocal_prominence: string; // instrumental_dominant, balanced, vocal_dominant
  lyrical_depth: string; // none_instrumental, surface_party, narrative_storytelling, emotional_confessional, poetic_literary, political_social
  emotional_tone: string[]; // euphoric, melancholy, aggressive, serene, dark, playful, romantic, anxious, triumphant, nostalgic, dreamy, intense, peaceful, rebellious
  complexity: number; // 1-5
  harmonic_sophistication: string; // simple_pop, moderate, sophisticated, jazz_level, experimental
  rhythmic_character: string; // steady_driving, groovy_syncopated, complex_shifting, ambient_free, varied
  sub_genres: string[];
  themes: string[];
  special_tags: string[]; // iconic, legendary, genre_defining, genre_bending, great_live_act, prolific, one_hit_wonder, critically_acclaimed, underground_hero, comeback, influential, singer_songwriter, supergroup
}

// --- Podcast Tags ---
export interface PodcastTags {
  podcast_format: string; // narrative_produced, conversational_interview, solo_commentary, panel_roundtable, educational_lecture, fiction_audio_drama, mixed
  subject_domain: string[]; // current_events, technology, business, science, history, true_crime, comedy, culture, health, sports, personal_development, storytelling, politics, finance, gaming, relationships, philosophy, nature
  host_style: string; // formal_authoritative, casual_warm, comedic_irreverent, provocative_challenging, academic_expert, journalistic
  information_density: string; // high, medium, low
  production_quality: string; // high_cinematic, good, moderate, lo_fi_authentic
  emotional_tone: string[]; // serious, light, inspiring, dark, playful, intimate, intense, educational, entertaining, provocative
  complexity: number; // 1-5
  episode_length_category: string; // short_under_30, medium_30_60, long_60_120, marathon_over_120
  host_count: string; // solo, duo, panel, rotating, varied
  serialization: string; // fully_serialized, loosely_serialized, standalone_episodes, mixed
  currency: string; // current_events_focused, mixed, evergreen_timeless
  content_warnings: string[];
  special_tags: string[]; // binge_worthy, great_for_commutes, award_winning, celebrity_host, expert_host, investigative, feel_good, addictive, educational, thought_provoking, daily, completed_series
}

export type ItemTags = MovieTags | TVShowTags | BookTags | MusicArtistTags | PodcastTags;

// --- Enrichment Prompts ---

const MOVIE_ENRICHMENT = `You are a film analyst. Given a movie's details, provide precise taste-dimension tags.

Return JSON with this exact structure:
{
  "emotional_tone": ["the specific emotional experiences this film produces — be precise. Options: euphoric, warm, melancholy, tense, dark, playful, serene, inspiring, irreverent, unsettling, bittersweet, nostalgic, anxious, triumphant, contemplative"],
  "complexity": 1-5,
  "pacing": "slow | measured | moderate | brisk | relentless",
  "darkness_intensity": "light | moderate | dark | very_dark | extreme",
  "character_moral_complexity": "likable | flawed | antihero | repellent | mixed",
  "primary_engagement": "emotional | intellectual | visceral | fun | mixed",
  "storytelling_vehicle": "dialogue_driven | visual_storytelling | action_driven | balanced",
  "tonal_consistency": "pure_tone | some_mixing | wild_shifts",
  "protagonist_likability": "highly_likable | relatable | complex | difficult | repellent",
  "resolution_style": "neat_closure | mostly_resolved | ambiguous | open_ended | devastating",
  "scale": "intimate | mid_range | epic | grand_spectacle",
  "originality": "wholly_original | fresh_take | familiar_well_executed | formulaic",
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes"],
  "content_warnings": ["graphic_violence | gore | sexual_content | disturbing_imagery | drug_use | self_harm | animal_cruelty | none"],
  "special_tags": ["ends_with_twist", "based_on_true_story", "cult_classic", "visually_stunning", "mind_bending", "feel_good", "tear_jerker", "franchise", "sequel", "animated", "foreign_language", "award_winner", "director_driven", "crowd_pleaser", "underrated", "comfort_watch"]
}

Be precise with emotional_tone — "dark" and "melancholy" are different. "Tense" and "anxious" are different.
Only include tags that genuinely apply. Return valid JSON only.`;

const TV_ENRICHMENT = `You are a TV analyst. Given a show's details, provide precise taste-dimension tags.

Return JSON with this exact structure:
{
  "emotional_tone": ["specific emotional experiences — euphoric, warm, melancholy, tense, dark, playful, serene, inspiring, irreverent, unsettling, bittersweet, nostalgic, anxious, triumphant, contemplative"],
  "complexity": 1-5,
  "pacing": "slow | measured | moderate | brisk | relentless",
  "darkness_intensity": "light | moderate | dark | very_dark | extreme",
  "serialization": "episodic | hybrid | serialized | anthology",
  "character_moral_complexity": "likable | flawed | antihero | repellent | mixed",
  "primary_engagement": "emotional | intellectual | visceral | fun | mixed",
  "comfort_rewatch_quotient": "high | medium | low",
  "burn_speed": "instant_hook | steady_build | slow_burn | very_slow_burn",
  "protagonist_likability": "highly_likable | relatable | complex | difficult | repellent",
  "humor_integration": "comedy_first | humor_throughout | occasional_levity | serious | dark_humor",
  "commitment_level": "limited_single_season | short_2_3_seasons | medium_4_6_seasons | long_running",
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes"],
  "content_warnings": ["graphic_violence | gore | sexual_content | disturbing_imagery | drug_use | none"],
  "special_tags": ["binge_worthy", "comfort_show", "prestige", "procedural", "reality_based", "animated", "foreign_language", "cult_classic", "perfect_ending", "controversial_ending", "cancelled_too_soon", "ensemble_cast", "great_pilot", "slow_start_fast_finish"]
}

Return valid JSON only.`;

const BOOK_ENRICHMENT = `You are a literary analyst. Given a book's details, provide precise taste-dimension tags.

Return JSON with this exact structure:
{
  "emotional_tone": ["specific emotional experiences — euphoric, warm, melancholy, tense, dark, playful, serene, inspiring, irreverent, unsettling, bittersweet, nostalgic, anxious, triumphant, contemplative, haunting"],
  "complexity": 1-5,
  "pacing": "slow | measured | moderate | brisk | relentless",
  "darkness_intensity": "light | moderate | dark | very_dark | extreme",
  "prose_style_density": "sparse | balanced | lush | ornate",
  "prose_style_accessibility": "accessible | moderate | literary | experimental",
  "character_moral_complexity": "likable | flawed | antihero | repellent | mixed",
  "primary_engagement": "emotional | intellectual | visceral | fun | mixed",
  "reading_purpose": "escapism | emotional_experience | intellectual_stimulation | self_improvement | aesthetic_pleasure",
  "length_category": "short_under_250 | medium_250_400 | long_400_600 | epic_over_600",
  "is_series": true/false,
  "is_fiction": true/false,
  "protagonist_likability": "highly_likable | relatable | complex | difficult | repellent | not_applicable",
  "resolution_style": "neat_closure | mostly_resolved | ambiguous | open_ended | devastating | not_applicable",
  "internal_monologue_level": "minimal | moderate | heavy | stream_of_consciousness",
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes"],
  "content_warnings": ["graphic_violence | sexual_content | disturbing_content | heavy_themes | none"],
  "special_tags": ["page_turner", "twist_ending", "unreliable_narrator", "award_winner", "classic", "modern_classic", "translated", "beautiful_prose", "thought_provoking", "comfort_read", "debut_novel", "book_club_pick", "multiple_pov"],
  "nonfiction_type": "narrative | idea_driven | practical | academic | memoir | investigative" or null if fiction,
  "nonfiction_depth": "popular_accessible | moderate | deep_rigorous" or null if fiction
}

Return valid JSON only.`;

const MUSIC_ENRICHMENT = `You are a music analyst. Given an artist's details, provide precise taste-dimension tags.

Return JSON with this exact structure:
{
  "energy_intensity": "ambient | low | medium | high | extreme | varied",
  "sonic_texture_organic": "fully_organic | mostly_organic | hybrid | mostly_electronic | fully_electronic",
  "sonic_texture_production": "raw_lo_fi | natural | balanced | polished | hyper_produced",
  "sonic_density": "minimal_sparse | moderate | dense_layered | maximalist",
  "vocal_style": "clean_melodic | raw_textured | rap_spoken | screamed_harsh | instrumental_only | varied",
  "vocal_prominence": "instrumental_dominant | balanced | vocal_dominant",
  "lyrical_depth": "none_instrumental | surface_party | narrative_storytelling | emotional_confessional | poetic_literary | political_social",
  "emotional_tone": ["euphoric, melancholy, aggressive, serene, dark, playful, romantic, anxious, triumphant, nostalgic, dreamy, intense, peaceful, rebellious"],
  "complexity": 1-5,
  "harmonic_sophistication": "simple_pop | moderate | sophisticated | jazz_level | experimental",
  "rhythmic_character": "steady_driving | groovy_syncopated | complex_shifting | ambient_free | varied",
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes in their music"],
  "special_tags": ["iconic", "legendary", "genre_defining", "genre_bending", "great_live_act", "prolific", "one_hit_wonder", "critically_acclaimed", "underground_hero", "comeback", "influential", "singer_songwriter", "supergroup"]
}

Return valid JSON only.`;

const PODCAST_ENRICHMENT = `You are a podcast analyst. Given a podcast's details, provide precise taste-dimension tags.

Return JSON with this exact structure:
{
  "podcast_format": "narrative_produced | conversational_interview | solo_commentary | panel_roundtable | educational_lecture | fiction_audio_drama | mixed",
  "subject_domain": ["primary and secondary topics — current_events, technology, business, science, history, true_crime, comedy, culture, health, sports, personal_development, storytelling, politics, finance, gaming, relationships, philosophy, nature"],
  "host_style": "formal_authoritative | casual_warm | comedic_irreverent | provocative_challenging | academic_expert | journalistic",
  "information_density": "high | medium | low",
  "production_quality": "high_cinematic | good | moderate | lo_fi_authentic",
  "emotional_tone": ["serious, light, inspiring, dark, playful, intimate, intense, educational, entertaining, provocative"],
  "complexity": 1-5,
  "episode_length_category": "short_under_30 | medium_30_60 | long_60_120 | marathon_over_120",
  "host_count": "solo | duo | panel | rotating | varied",
  "serialization": "fully_serialized | loosely_serialized | standalone_episodes | mixed",
  "currency": "current_events_focused | mixed | evergreen_timeless",
  "content_warnings": ["explicit_language | violent_content | heavy_themes | none"],
  "special_tags": ["binge_worthy", "great_for_commutes", "award_winning", "celebrity_host", "expert_host", "investigative", "feel_good", "addictive", "educational", "thought_provoking", "daily", "completed_series"]
}

Return valid JSON only.`;

const ENRICHMENT_PROMPTS: Record<string, string> = {
  movies: MOVIE_ENRICHMENT,
  tv_shows: TV_ENRICHMENT,
  books: BOOK_ENRICHMENT,
  fiction_books: BOOK_ENRICHMENT,
  nonfiction_books: BOOK_ENRICHMENT,
  music_artists: MUSIC_ENRICHMENT,
  podcasts: PODCAST_ENRICHMENT,
};

// Enrich a single item with LLM-generated tags
export async function enrichItem(
  title: string,
  creator: string | null,
  genres: string[],
  year: number | null,
  description: string | null,
  category: string
): Promise<ItemTags | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const promptCategory = ['fiction_books', 'nonfiction_books'].includes(category) ? 'books' : category;
  const systemPrompt = ENRICHMENT_PROMPTS[promptCategory];
  if (!systemPrompt) return null;

  const itemInfo = [
    `Title: ${title}`,
    creator ? `Creator: ${creator}` : null,
    year ? `Year: ${year}` : null,
    genres.length > 0 ? `Genres: ${genres.join(', ')}` : null,
    description ? `Description: ${description.slice(0, 300)}` : null,
  ].filter(Boolean).join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: itemInfo },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// Batch enrich items in the database
export async function enrichItemsInDB(
  supabase: SupabaseClient,
  category: string,
  limit: number = 50
): Promise<{ enriched: number; skipped: number; errors: number }> {
  const categoryFilter = category === 'books'
    ? ['books', 'fiction_books', 'nonfiction_books']
    : [category];

  const { data: items } = await supabase
    .from('items')
    .select('id, title, creator, genres, year, description, category, metadata')
    .in('category', categoryFilter)
    .limit(limit);

  if (!items) return { enriched: 0, skipped: 0, errors: 0 };

  let enriched = 0, skipped = 0, errors = 0;

  for (const item of items) {
    const metadata = (item.metadata || {}) as Record<string, unknown>;

    if (metadata.tags) {
      skipped++;
      continue;
    }

    try {
      const tags = await enrichItem(
        item.title,
        item.creator,
        item.genres || [],
        item.year,
        item.description,
        item.category
      );

      if (tags) {
        await supabase
          .from('items')
          .update({
            metadata: { ...metadata, tags },
          })
          .eq('id', item.id);
        enriched++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { enriched, skipped, errors };
}
