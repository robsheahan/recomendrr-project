import { SupabaseClient } from '@supabase/supabase-js';

export interface ItemTags {
  sub_genres: string[];
  themes: string[];
  tone: string[];
  pacing: string;
  complexity: string;
  audience: string;
  popularity_tier: string;
  special_tags: string[];
  content_warnings: string[];
  setting_era: string;
  narrative_style: string;
}

const ENRICHMENT_PROMPTS: Record<string, string> = {
  movies: `You are a film cataloguer. Given a movie's title, year, genres, and description, provide detailed tags.

Return JSON with this exact structure:
{
  "sub_genres": ["psychological thriller", "neo-noir", "heist film"],
  "themes": ["redemption", "corruption", "identity", "betrayal", "family", "isolation", "justice", "survival", "class", "power", "love", "obsession", "grief", "revenge", "morality"],
  "tone": ["dark", "tense", "gritty", "lighthearted", "whimsical", "bleak", "uplifting", "melancholic", "suspenseful", "humorous", "intense", "dreamlike", "warm"],
  "pacing": "slow burn" | "methodical" | "moderate" | "fast-paced" | "relentless",
  "complexity": "simple" | "moderate" | "layered" | "complex" | "dense",
  "audience": "mainstream" | "broad appeal" | "cinephile" | "art-house" | "cult",
  "popularity_tier": "blockbuster" | "mainstream hit" | "well-known" | "mid-range" | "indie" | "obscure",
  "special_tags": ["ends with a twist", "based on true story", "ensemble cast", "unreliable narrator", "non-linear timeline", "cult classic", "feel-good", "tear-jerker", "mind-bending", "visually stunning", "dialogue-driven", "character study", "slow cinema", "crowd-pleaser", "sleeper hit", "underrated gem", "franchise", "sequel", "remake", "foreign language", "animated", "black and white"],
  "content_warnings": ["graphic violence", "overly gory", "sexual content", "heavy themes", "disturbing imagery", "drug use", "none"],
  "setting_era": "contemporary" | "period piece" | "futuristic" | "historical" | "timeless" | "mixed",
  "narrative_style": "linear" | "non-linear" | "anthology" | "found footage" | "documentary style" | "ensemble" | "single protagonist" | "dual timeline" | "epistolary"
}

Rules:
- Only include sub_genres, themes, tone, special_tags, and content_warnings that genuinely apply
- Be specific with sub_genres — "psychological thriller" not just "thriller"
- special_tags should capture distinctive qualities that help match with user preferences
- Be honest about content_warnings — if it's gory, say so
- Return valid JSON only`,

  tv_shows: `You are a TV show cataloguer. Given a show's title, year, genres, and description, provide detailed tags.

Return JSON with this exact structure:
{
  "sub_genres": ["prestige drama", "workplace comedy", "procedural", "limited series"],
  "themes": ["power", "family", "corruption", "identity", "survival", "justice", "love", "class", "revenge", "grief", "coming of age", "loyalty"],
  "tone": ["dark", "tense", "comedic", "warm", "gritty", "lighthearted", "suspenseful", "satirical", "dramatic", "quirky"],
  "pacing": "slow burn" | "steady" | "moderate" | "fast-paced" | "binge-worthy",
  "complexity": "simple" | "moderate" | "layered" | "complex" | "dense",
  "audience": "mainstream" | "broad appeal" | "prestige" | "niche" | "cult",
  "popularity_tier": "cultural phenomenon" | "mainstream hit" | "well-known" | "mid-range" | "hidden gem" | "obscure",
  "special_tags": ["binge-worthy", "ends with a twist", "based on true story", "ensemble cast", "anthology", "limited series", "long-running", "cult classic", "comfort show", "critically acclaimed", "cancelled too soon", "perfect ending", "controversial ending", "great pilot", "slow start fast finish", "foreign language", "animated", "reality-based", "mockumentary"],
  "content_warnings": ["graphic violence", "sexual content", "heavy themes", "disturbing imagery", "drug use", "none"],
  "setting_era": "contemporary" | "period piece" | "futuristic" | "historical" | "timeless" | "mixed",
  "narrative_style": "serialized" | "episodic" | "anthology" | "mockumentary" | "ensemble" | "single protagonist" | "dual timeline"
}

Rules:
- Be specific with sub_genres
- special_tags should capture what makes this show distinctive
- Return valid JSON only`,

  books: `You are a book cataloguer. Given a book's title, author, genres, and description, provide detailed tags.

Return JSON with this exact structure:
{
  "sub_genres": ["literary fiction", "psychological thriller", "epic fantasy", "popular science", "memoir"],
  "themes": ["identity", "power", "family", "love", "survival", "justice", "class", "redemption", "grief", "obsession", "coming of age", "war", "technology", "nature", "spirituality"],
  "tone": ["lyrical", "gripping", "contemplative", "humorous", "dark", "uplifting", "haunting", "conversational", "academic", "whimsical", "intense", "warm"],
  "pacing": "leisurely" | "measured" | "moderate" | "page-turner" | "relentless",
  "complexity": "accessible" | "moderate" | "literary" | "complex" | "dense",
  "audience": "mainstream" | "book club" | "literary" | "academic" | "niche",
  "popularity_tier": "bestseller" | "well-known" | "book club favorite" | "mid-range" | "hidden gem" | "obscure",
  "special_tags": ["page-turner", "twist ending", "unreliable narrator", "based on true story", "award winner", "debut novel", "series", "standalone", "short read", "epic length", "multiple POV", "beautiful prose", "thought-provoking", "beach read", "comfort read", "cult classic", "banned book", "classic", "modern classic", "translated"],
  "content_warnings": ["graphic violence", "sexual content", "heavy themes", "disturbing content", "none"],
  "setting_era": "contemporary" | "historical" | "futuristic" | "timeless" | "mixed",
  "narrative_style": "first person" | "third person" | "multiple POV" | "epistolary" | "non-linear" | "stream of consciousness" | "linear"
}

Rules:
- Cover both fiction and non-fiction appropriately
- Be specific with sub_genres
- Return valid JSON only`,

  music_artists: `You are a music cataloguer. Given an artist's name and genres, provide detailed tags.

Return JSON with this exact structure:
{
  "sub_genres": ["indie rock", "synth-pop", "conscious hip-hop", "neo-soul"],
  "themes": ["love", "social commentary", "personal struggle", "party", "introspection", "rebellion", "spirituality", "nostalgia", "empowerment"],
  "tone": ["energetic", "melancholic", "uplifting", "dark", "chill", "aggressive", "dreamy", "raw", "polished", "experimental"],
  "pacing": "high energy" | "mid-tempo" | "varied" | "mellow" | "intense",
  "complexity": "accessible" | "moderate" | "intricate" | "experimental" | "avant-garde",
  "audience": "mainstream" | "broad appeal" | "indie" | "underground" | "niche",
  "popularity_tier": "superstar" | "mainstream" | "well-known" | "mid-range" | "emerging" | "underground",
  "special_tags": ["iconic", "legendary", "one-hit wonder", "prolific", "great live act", "producer", "singer-songwriter", "band", "solo artist", "collaboration heavy", "genre-defining", "genre-bending", "critically acclaimed", "commercial success", "cult following", "comeback", "influential"],
  "content_warnings": ["explicit lyrics", "none"],
  "setting_era": "classic" | "90s" | "2000s" | "2010s" | "current" | "timeless",
  "narrative_style": "storyteller" | "confessional" | "abstract" | "political" | "party" | "atmospheric"
}

Return valid JSON only`,

  podcasts: `You are a podcast cataloguer. Given a podcast's title, host, and description, provide detailed tags.

Return JSON with this exact structure:
{
  "sub_genres": ["true crime investigation", "interview show", "narrative non-fiction", "comedy panel"],
  "themes": ["crime", "science", "history", "culture", "politics", "technology", "self-improvement", "storytelling", "comedy", "business", "relationships", "philosophy"],
  "tone": ["conversational", "investigative", "educational", "comedic", "serious", "casual", "intense", "inspiring", "informative", "entertaining"],
  "pacing": "binge-worthy" | "steady" | "varied" | "dense" | "casual",
  "complexity": "casual listen" | "moderate" | "in-depth" | "expert level",
  "audience": "mainstream" | "broad appeal" | "niche" | "professional" | "enthusiast",
  "popularity_tier": "top chart" | "well-known" | "popular" | "mid-range" | "hidden gem" | "niche",
  "special_tags": ["binge-worthy", "great for commutes", "interview format", "solo host", "panel show", "narrative", "serialized", "educational", "celebrity host", "award-winning", "daily", "weekly", "completed series", "long-running", "short episodes", "long episodes"],
  "content_warnings": ["explicit language", "violent content", "heavy themes", "none"],
  "setting_era": "current" | "historical focus" | "timeless",
  "narrative_style": "interview" | "narrative" | "conversational" | "documentary" | "panel" | "solo commentary" | "mixed"
}

Return valid JSON only`,
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
  // Find items that don't have tags yet
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

    // Skip if already enriched
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
