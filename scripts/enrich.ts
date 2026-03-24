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

const ENRICHMENT_PROMPT = `You are a media cataloguer. Given an item's details, provide detailed tags.

Return JSON:
{
  "sub_genres": ["specific sub-genres"],
  "themes": ["key themes"],
  "tone": ["tone descriptors"],
  "pacing": "slow burn | methodical | moderate | fast-paced | relentless",
  "complexity": "simple | moderate | layered | complex | dense",
  "audience": "mainstream | broad appeal | cinephile | art-house | cult | niche",
  "popularity_tier": "blockbuster | mainstream hit | well-known | mid-range | hidden gem | obscure",
  "special_tags": ["ends with a twist", "based on true story", "cult classic", "visually stunning", "feel-good", "tear-jerker", "mind-bending", "overly gory", "crowd-pleaser", "underrated gem", "award winner", "comfort watch", "dialogue-driven", "character study", "foreign language", "animated", etc.],
  "content_warnings": ["graphic violence", "overly gory", "sexual content", "heavy themes", "none"],
  "setting_era": "contemporary | period piece | futuristic | historical | timeless",
  "narrative_style": "linear | non-linear | ensemble | single protagonist | anthology | etc."
}

Only include tags that genuinely apply. Be specific. Return valid JSON only.`;

async function enrichItem(item: ItemRow) {
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
        { role: 'system', content: ENRICHMENT_PROMPT },
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
  const batchSize = 500;

  const categoryFilter = category === 'books'
    ? ['books', 'fiction_books', 'nonfiction_books']
    : category === 'all'
      ? ['movies', 'tv_shows', 'books', 'fiction_books', 'nonfiction_books', 'music_artists', 'podcasts']
      : [category];

  let totalEnriched = 0, totalErrors = 0;
  let hasMore = true;
  let offset = 0;

  while (hasMore) {
    // Fetch a batch
    const { data: items, error } = await supabase
      .from('items')
      .select('id, title, creator, genres, year, description, category, metadata')
      .in('category', categoryFilter)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('DB error:', error.message);
      break;
    }

    if (!items || items.length === 0) {
      hasMore = false;
      break;
    }

    // Filter to unenriched
    const unenriched = (items as ItemRow[]).filter((item) => {
      const meta = item.metadata || {};
      return !meta.tags;
    });

    if (unenriched.length === 0) {
      offset += batchSize;
      if (items.length < batchSize) hasMore = false;
      continue;
    }

    for (const item of unenriched) {
      try {
        const tags = await enrichItem(item);
        await supabase
          .from('items')
          .update({ metadata: { ...(item.metadata || {}), tags } })
          .eq('id', item.id);
        totalEnriched++;
        process.stdout.write(`\r${totalEnriched} enriched (${totalErrors} errors) — ${item.title}`);
      } catch {
        totalErrors++;
      }
    }

    offset += batchSize;
    if (items.length < batchSize) hasMore = false;
  }

  console.log(`\n\nDone: ${totalEnriched} enriched, ${totalErrors} errors`);
}

main().catch(console.error);
