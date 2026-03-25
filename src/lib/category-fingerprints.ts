import { Item, Rating } from '@/types/database';

// --- Cross-Category Fingerprint (revised) ---
export interface CrossCategoryFingerprint {
  complexity_appetite: 'accessible' | 'moderate' | 'layered' | 'dense';
  darkness_tolerance: 'avoids_dark' | 'moderate' | 'embraces_dark' | 'seeks_dark';
  emotional_mode: 'comfort_seeking' | 'balanced' | 'challenge_seeking';
  consumption_style: 'deep_diver' | 'balanced' | 'wide_sampler';
  discovery_posture: 'mainstream_first' | 'balanced' | 'off_the_beaten_path';
  universal_theme_affinities: string[];
  universal_dealbreakers: string[];
  summary: string;
}

// --- Per-Category Fingerprints ---
export interface MovieFingerprint {
  primary_draw: 'story_and_character' | 'visual_craft' | 'spectacle_and_entertainment' | 'ideas_and_themes';
  watching_mode: 'emotional_experience' | 'intellectual_engagement' | 'pure_entertainment' | 'mixed';
  storytelling_vehicle: 'dialogue_driven' | 'visual_storytelling' | 'action_driven' | 'balanced';
  resolution_preference: 'needs_closure' | 'tolerates_ambiguity' | 'loves_ambiguity';
  structural_adventurousness: 'conventional' | 'moderate' | 'experimental';
  moral_spectrum: 'clear_morality' | 'some_ambiguity' | 'full_moral_grey';
  intensity_ceiling: 'family_friendly' | 'moderate' | 'intense' | 'extreme';
  tonal_consistency: 'prefers_pure_tone' | 'enjoys_tonal_mixing' | 'no_preference';
  scale_preference: 'intimate_small' | 'mid_range' | 'epic_large' | 'no_preference';
  franchise_appetite: 'avoids_franchises' | 'selective' | 'franchise_enthusiast';
  auteur_sensitivity: 'low' | 'moderate' | 'high';
  animation_openness: 'enthusiast' | 'selective' | 'avoids';
  era_sweet_spot: 'classic_pre1980' | 'modern_1980_2010' | 'contemporary_post2010' | 'no_preference';
  foreign_language_openness: 'avoids' | 'selective' | 'enthusiastic';
  signature_preferences: string[];
  category_dealbreakers: string[];
  movie_taste_summary: string;
}

export interface TVShowFingerprint {
  narrative_structure: 'serialized_arc' | 'episodic' | 'anthology' | 'no_preference';
  commitment_preference: 'limited_series' | 'moderate_2_4_seasons' | 'long_running' | 'no_preference';
  binge_orientation: 'needs_bingeability' | 'patient_viewer' | 'no_preference';
  prestige_orientation: 'prestige_focused' | 'balanced' | 'comfort_entertainment_focused';
  reality_openness: 'enthusiast' | 'selective' | 'avoids_entirely';
  sitcom_affinity: 'loves_sitcoms' | 'selective' | 'rarely_watches';
  procedural_appetite: 'enjoys' | 'selective' | 'avoids';
  sustained_darkness_tolerance: 'light_medium' | 'moderate' | 'dark' | 'very_dark';
  tv_function: 'escapism_relaxation' | 'engagement_stimulation' | 'both_mood_dependent';
  humor_in_drama: 'essential' | 'appreciated' | 'unnecessary' | 'distracting';
  era_sweet_spot: 'golden_age_pre2000' | 'peak_tv_2000_2015' | 'contemporary' | 'no_preference';
  animation_appetite: 'anime_enthusiast' | 'adult_animation_fan' | 'selective' | 'avoids';
  rewatch_pattern: 'frequent_rewatcher' | 'occasional' | 'always_new';
  signature_preferences: string[];
  category_dealbreakers: string[];
  tv_taste_summary: string;
}

export interface BookFingerprint {
  prose_sensitivity: 'story_focused_reader' | 'appreciates_good_prose' | 'prose_connoisseur';
  length_preference: 'short_under_300' | 'standard' | 'long_form' | 'epic_reader' | 'no_preference';
  series_appetite: 'loves_series' | 'selective_about_series' | 'prefers_standalone';
  literary_commercial_spectrum: 'literary' | 'literary_leaning' | 'balanced' | 'commercial_leaning' | 'genre_focused';
  fiction_nonfiction_balance: 'fiction_only' | 'fiction_leaning' | 'balanced' | 'nonfiction_leaning' | 'nonfiction_only';
  experimental_tolerance: 'traditional' | 'moderate' | 'loves_experimental';
  emotional_intensity: 'light_escapist' | 'moderate' | 'deeply_emotional' | 'devastating_is_fine';
  character_moral_complexity: 'sympathetic_leads' | 'some_complexity' | 'loves_antiheroes' | 'full_moral_grey';
  ending_preference: 'needs_hopeful' | 'no_preference' | 'prefers_realistic_even_if_bleak';
  content_sensitivity: 'conservative' | 'moderate' | 'liberal' | 'nothing_off_limits';
  nonfiction_style: 'narrative_nonfiction' | 'idea_driven' | 'practical_self_help' | 'academic' | 'mixed' | null;
  translation_openness: 'avoids' | 'selective' | 'enthusiastic';
  genre_loyalty: 'genre_loyal' | 'genre_curious' | 'widely_eclectic';
  signature_preferences: string[];
  category_dealbreakers: string[];
  book_taste_summary: string;
}

export interface MusicArtistFingerprint {
  default_energy: 'low_ambient_chill' | 'moderate' | 'high_energy' | 'varied';
  vocal_preference: 'vocal_focused' | 'balanced' | 'instrumental_leaning' | 'no_preference';
  production_aesthetic: 'polished_clean' | 'balanced' | 'raw_lo_fi' | 'no_preference';
  instrumentation_spectrum: 'fully_electronic' | 'electronic_leaning' | 'balanced' | 'organic_leaning' | 'fully_organic';
  sonic_density: 'minimal_sparse' | 'moderate' | 'dense_layered' | 'no_preference';
  lyrical_importance: 'lyrics_first' | 'important' | 'secondary_to_sound' | 'irrelevant';
  lyrical_mode: 'storytelling' | 'emotional_expression' | 'intellectual_wordplay' | 'vibes_over_meaning' | 'mixed';
  emotional_function: 'mood_regulation' | 'emotional_catharsis' | 'energy_activation' | 'background_atmosphere' | 'mixed';
  genre_adventurousness: 'genre_loyalist' | 'adjacent_explorer' | 'omnivore';
  genre_blending_appetite: 'prefers_pure_genre' | 'enjoys_some_blending' | 'loves_genre_bending';
  mainstream_underground: 'mainstream' | 'indie_leaning' | 'underground' | 'no_preference';
  artist_depth: 'deep_discography_listener' | 'moderate' | 'singles_and_hits';
  era_preference: 'legacy_classic' | 'established' | 'emerging_new' | 'no_preference';
  signature_preferences: string[];
  category_dealbreakers: string[];
  music_taste_summary: string;
}

export interface PodcastFingerprint {
  format_preference: 'interview' | 'narrative_storytelling' | 'conversational_chat' | 'educational_lecture' | 'panel_roundtable' | 'mixed';
  episode_structure: 'serialized_seasons' | 'standalone_episodes' | 'no_preference';
  length_preference: 'short_under_30min' | 'medium_30_60min' | 'long_60_120min' | 'marathon_over_120min' | 'no_preference';
  host_format: 'solo' | 'duo_co_hosts' | 'panel' | 'rotating' | 'no_preference';
  host_personality_importance: 'critical_follow_the_host' | 'important' | 'secondary_to_content';
  production_expectation: 'lo_fi_authentic' | 'moderate' | 'highly_produced_narrative' | 'no_preference';
  depth_preference: 'casual_light' | 'moderate' | 'deep_dive_expert' | 'academic_level';
  learning_entertainment_balance: 'primarily_learning' | 'balanced' | 'primarily_entertainment';
  humor_expectation: 'comedy_focused' | 'humor_mixed_in' | 'serious_tone' | 'no_preference';
  heaviness_tolerance: 'light_only' | 'moderate' | 'heavy_topics_fine' | 'no_limits';
  true_crime_affinity: 'enthusiast' | 'selective' | 'avoids';
  primary_listening_context: 'commute' | 'exercise' | 'focused_at_desk' | 'chores_background' | 'before_sleep' | 'varied';
  signature_preferences: string[];
  category_dealbreakers: string[];
  podcast_taste_summary: string;
}

export type CategoryFingerprintData =
  | MovieFingerprint
  | TVShowFingerprint
  | BookFingerprint
  | MusicArtistFingerprint
  | PodcastFingerprint;

// --- Generation Prompts ---

const CATEGORY_PROMPTS: Record<string, string> = {
  movies: `You are a taste psychologist analysing someone's movie preferences. Given their ratings and tag patterns, infer their deep movie taste fingerprint.

Return JSON with this exact structure:
{
  "primary_draw": "story_and_character | visual_craft | spectacle_and_entertainment | ideas_and_themes",
  "watching_mode": "emotional_experience | intellectual_engagement | pure_entertainment | mixed",
  "storytelling_vehicle": "dialogue_driven | visual_storytelling | action_driven | balanced",
  "resolution_preference": "needs_closure | tolerates_ambiguity | loves_ambiguity",
  "structural_adventurousness": "conventional | moderate | experimental",
  "moral_spectrum": "clear_morality | some_ambiguity | full_moral_grey",
  "intensity_ceiling": "family_friendly | moderate | intense | extreme",
  "tonal_consistency": "prefers_pure_tone | enjoys_tonal_mixing | no_preference",
  "scale_preference": "intimate_small | mid_range | epic_large | no_preference",
  "franchise_appetite": "avoids_franchises | selective | franchise_enthusiast",
  "auteur_sensitivity": "low | moderate | high",
  "animation_openness": "enthusiast | selective | avoids",
  "era_sweet_spot": "classic_pre1980 | modern_1980_2010 | contemporary_post2010 | no_preference",
  "foreign_language_openness": "avoids | selective | enthusiastic",
  "signature_preferences": ["2-4 specific qualities this person gravitates toward — be concrete, e.g. 'loves heist mechanics', 'drawn to father-son dynamics'"],
  "category_dealbreakers": ["2-4 specific things that kill a movie for this person"],
  "movie_taste_summary": "3-4 sentence summary that could guide a recommendation engine"
}
Base analysis on PATTERNS in the ratings. Return valid JSON only.`,

  tv_shows: `You are a taste psychologist analysing someone's TV show preferences. Given their ratings and tag patterns, infer their deep TV taste fingerprint.

Return JSON with this exact structure:
{
  "narrative_structure": "serialized_arc | episodic | anthology | no_preference",
  "commitment_preference": "limited_series | moderate_2_4_seasons | long_running | no_preference",
  "binge_orientation": "needs_bingeability | patient_viewer | no_preference",
  "prestige_orientation": "prestige_focused | balanced | comfort_entertainment_focused",
  "reality_openness": "enthusiast | selective | avoids_entirely",
  "sitcom_affinity": "loves_sitcoms | selective | rarely_watches",
  "procedural_appetite": "enjoys | selective | avoids",
  "sustained_darkness_tolerance": "light_medium | moderate | dark | very_dark",
  "tv_function": "escapism_relaxation | engagement_stimulation | both_mood_dependent",
  "humor_in_drama": "essential | appreciated | unnecessary | distracting",
  "era_sweet_spot": "golden_age_pre2000 | peak_tv_2000_2015 | contemporary | no_preference",
  "animation_appetite": "anime_enthusiast | adult_animation_fan | selective | avoids",
  "rewatch_pattern": "frequent_rewatcher | occasional | always_new",
  "signature_preferences": ["2-4 specific qualities"],
  "category_dealbreakers": ["2-4 specific dealbreakers"],
  "tv_taste_summary": "3-4 sentence summary"
}
Return valid JSON only.`,

  books: `You are a taste psychologist analysing someone's book preferences. Given their ratings and tag patterns, infer their deep reading taste fingerprint.

Return JSON with this exact structure:
{
  "prose_sensitivity": "story_focused_reader | appreciates_good_prose | prose_connoisseur",
  "length_preference": "short_under_300 | standard | long_form | epic_reader | no_preference",
  "series_appetite": "loves_series | selective_about_series | prefers_standalone",
  "literary_commercial_spectrum": "literary | literary_leaning | balanced | commercial_leaning | genre_focused",
  "fiction_nonfiction_balance": "fiction_only | fiction_leaning | balanced | nonfiction_leaning | nonfiction_only",
  "experimental_tolerance": "traditional | moderate | loves_experimental",
  "emotional_intensity": "light_escapist | moderate | deeply_emotional | devastating_is_fine",
  "character_moral_complexity": "sympathetic_leads | some_complexity | loves_antiheroes | full_moral_grey",
  "ending_preference": "needs_hopeful | no_preference | prefers_realistic_even_if_bleak",
  "content_sensitivity": "conservative | moderate | liberal | nothing_off_limits",
  "nonfiction_style": "narrative_nonfiction | idea_driven | practical_self_help | academic | mixed" or null,
  "translation_openness": "avoids | selective | enthusiastic",
  "genre_loyalty": "genre_loyal | genre_curious | widely_eclectic",
  "signature_preferences": ["2-4 specific qualities"],
  "category_dealbreakers": ["2-4 specific dealbreakers"],
  "book_taste_summary": "3-4 sentence summary"
}
Return valid JSON only.`,

  music_artists: `You are a taste psychologist analysing someone's music preferences. Given their ratings and tag patterns, infer their deep music taste fingerprint.

Return JSON with this exact structure:
{
  "default_energy": "low_ambient_chill | moderate | high_energy | varied",
  "vocal_preference": "vocal_focused | balanced | instrumental_leaning | no_preference",
  "production_aesthetic": "polished_clean | balanced | raw_lo_fi | no_preference",
  "instrumentation_spectrum": "fully_electronic | electronic_leaning | balanced | organic_leaning | fully_organic",
  "sonic_density": "minimal_sparse | moderate | dense_layered | no_preference",
  "lyrical_importance": "lyrics_first | important | secondary_to_sound | irrelevant",
  "lyrical_mode": "storytelling | emotional_expression | intellectual_wordplay | vibes_over_meaning | mixed",
  "emotional_function": "mood_regulation | emotional_catharsis | energy_activation | background_atmosphere | mixed",
  "genre_adventurousness": "genre_loyalist | adjacent_explorer | omnivore",
  "genre_blending_appetite": "prefers_pure_genre | enjoys_some_blending | loves_genre_bending",
  "mainstream_underground": "mainstream | indie_leaning | underground | no_preference",
  "artist_depth": "deep_discography_listener | moderate | singles_and_hits",
  "era_preference": "legacy_classic | established | emerging_new | no_preference",
  "signature_preferences": ["2-4 specific qualities"],
  "category_dealbreakers": ["2-4 specific dealbreakers"],
  "music_taste_summary": "3-4 sentence summary"
}
Return valid JSON only.`,

  podcasts: `You are a taste psychologist analysing someone's podcast preferences. Given their ratings and tag patterns, infer their deep podcast taste fingerprint.

Return JSON with this exact structure:
{
  "format_preference": "interview | narrative_storytelling | conversational_chat | educational_lecture | panel_roundtable | mixed",
  "episode_structure": "serialized_seasons | standalone_episodes | no_preference",
  "length_preference": "short_under_30min | medium_30_60min | long_60_120min | marathon_over_120min | no_preference",
  "host_format": "solo | duo_co_hosts | panel | rotating | no_preference",
  "host_personality_importance": "critical_follow_the_host | important | secondary_to_content",
  "production_expectation": "lo_fi_authentic | moderate | highly_produced_narrative | no_preference",
  "depth_preference": "casual_light | moderate | deep_dive_expert | academic_level",
  "learning_entertainment_balance": "primarily_learning | balanced | primarily_entertainment",
  "humor_expectation": "comedy_focused | humor_mixed_in | serious_tone | no_preference",
  "heaviness_tolerance": "light_only | moderate | heavy_topics_fine | no_limits",
  "true_crime_affinity": "enthusiast | selective | avoids",
  "primary_listening_context": "commute | exercise | focused_at_desk | chores_background | before_sleep | varied",
  "signature_preferences": ["2-4 specific qualities"],
  "category_dealbreakers": ["2-4 specific dealbreakers"],
  "podcast_taste_summary": "3-4 sentence summary"
}
Return valid JSON only.`,
};

// --- Generation ---

export const CATEGORY_FINGERPRINT_MIN_RATINGS = 5;
export const CATEGORY_REGEN_INTERVAL = 5; // Update every 5 new ratings

export function shouldRegenerateCategoryFingerprint(
  currentRatings: number,
  ratingsAtGeneration: number
): boolean {
  if (ratingsAtGeneration === 0 && currentRatings >= CATEGORY_FINGERPRINT_MIN_RATINGS) return true;
  if (currentRatings - ratingsAtGeneration >= CATEGORY_REGEN_INTERVAL) return true;
  return false;
}

function formatRatingsForLLM(ratings: (Rating & { item: Item })[]): string {
  const sorted = [...ratings].sort((a, b) => b.score - a.score);
  const lines: string[] = [];

  for (const r of sorted) {
    const tags = (r.item.metadata as Record<string, unknown>)?.tags as Record<string, unknown> | undefined;
    const tagInfo = tags ? ` [${Object.entries(tags).filter(([k, v]) => typeof v === 'string' && k !== 'sub_genres' && k !== 'themes' && k !== 'special_tags' && k !== 'content_warnings').map(([k, v]) => `${k}:${v}`).join(', ')}]` : '';
    const genres = r.item.genres.length > 0 ? ` (${r.item.genres.join(', ')})` : '';
    lines.push(`${r.score}/5 — ${r.item.title}${r.item.year ? ` (${r.item.year})` : ''}${genres}${tagInfo}`);
  }

  return lines.join('\n');
}

export async function generateCategoryFingerprint(
  ratings: (Rating & { item: Item })[],
  category: string,
  crossCategorySummary?: string | null,
  previousFingerprint?: CategoryFingerprintData | null,
  ratingsAtLastGeneration?: number
): Promise<{ fingerprint: CategoryFingerprintData; evolutionNotes: string | null } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const cat = ['fiction_books', 'nonfiction_books'].includes(category) ? 'books' : category;
  const prompt = CATEGORY_PROMPTS[cat];
  if (!prompt) return null;

  const isUpdate = previousFingerprint && ratingsAtLastGeneration && ratingsAtLastGeneration > 0;

  let userMessage: string;

  if (isUpdate) {
    // EVOLUTION MODE: pass previous fingerprint + only new ratings
    const newRatings = ratings.slice(0, ratings.length - ratingsAtLastGeneration);
    const allRatingsSummary = formatRatingsForLLM(ratings);
    const newRatingsSummary = newRatings.length > 0 ? formatRatingsForLLM(newRatings) : 'No new ratings';

    userMessage = `EXISTING FINGERPRINT (evolve this — do not replace, refine and supplement):
${JSON.stringify(previousFingerprint, null, 2)}

COMPLETE RATING HISTORY (${ratings.length} total):
${allRatingsSummary}

NEW RATINGS SINCE LAST UPDATE (${newRatings.length} new):
${newRatingsSummary}

Update the fingerprint to incorporate the new ratings. Keep what's still accurate, adjust what has shifted, and note any evolution in the summary. The new data supplements the old — don't lose established patterns, but refine them with fresh evidence.

Also provide an "evolution_notes" field (string) describing what changed: e.g. "Recent ratings show a growing interest in psychological thrillers, while the preference for ensemble casts remains strong."`;
  } else {
    // INITIAL GENERATION: all ratings
    userMessage = `Here are this user's ${ratings.length} ratings in ${cat}:\n\n${formatRatingsForLLM(ratings)}`;
    userMessage += '\n\nAnalyse these ratings and infer this person\'s deep taste fingerprint for this category.';
    userMessage += '\n\nAlso provide an "evolution_notes" field (string) with a brief note on the key patterns you see.';
  }

  if (crossCategorySummary) {
    userMessage += `\n\nCross-category context: ${crossCategorySummary}`;
  }

  // Modify system prompt to include evolution_notes in response
  const systemPromptWithEvolution = prompt.replace(
    'Return valid JSON only.',
    'Also include "evolution_notes": "string describing what changed or key patterns". Return valid JSON only.'
  );

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPromptWithEvolution },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  const evolutionNotes = parsed.evolution_notes || null;
  delete parsed.evolution_notes;
  return { fingerprint: parsed as CategoryFingerprintData, evolutionNotes };
}

// --- Format for LLM prompt ---

export function formatCategoryFingerprint(
  fingerprint: CategoryFingerprintData,
  category: string
): string {
  const label = {
    movies: 'MOVIE', tv_shows: 'TV SHOW', books: 'BOOK',
    music_artists: 'MUSIC', podcasts: 'PODCAST',
  }[category] || category.toUpperCase();

  const lines = [`${label} FINGERPRINT:`];

  for (const [key, value] of Object.entries(fingerprint)) {
    if (key.endsWith('_summary')) continue; // Summary goes separately
    if (key === 'signature_preferences' || key === 'category_dealbreakers') {
      if (Array.isArray(value) && value.length > 0) {
        const labelText = key === 'signature_preferences' ? 'Signature' : 'Dealbreakers';
        lines.push(`- ${labelText}: ${value.join(', ')}`);
      }
      continue;
    }
    if (Array.isArray(value)) continue;
    const formatted = String(value).replace(/_/g, ' ');
    const keyFormatted = key.replace(/_/g, ' ');
    lines.push(`- ${keyFormatted}: ${formatted}`);
  }

  // Add summary
  const summaryKey = Object.keys(fingerprint).find((k) => k.endsWith('_summary'));
  if (summaryKey) {
    lines.push(`- Summary: ${(fingerprint as unknown as Record<string, unknown>)[summaryKey]}`);
  }

  return lines.join('\n');
}
