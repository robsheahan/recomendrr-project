/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const SERPAPI_KEY = process.env.SERPAPI_API_KEY!;

interface SerpResult {
  title: string;
  link?: string;
  snippet?: string;
  displayed_link?: string;
  rich_snippet?: {
    top?: {
      detected_extensions?: {
        rating?: number;
        reviews?: number;
      };
    };
  };
}

async function serpSearch(query: string): Promise<SerpResult[]> {
  const params = new URLSearchParams({
    api_key: SERPAPI_KEY,
    engine: 'google',
    q: query,
    num: '20',
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    console.error(`SerpAPI error: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.organic_results || [];
}

function parseBookFromResult(result: SerpResult): {
  title: string;
  creator: string | null;
  year: number | null;
  description: string;
  rating: number;
  vote_count: number;
} | null {
  // Only process book-related results
  const isBookSite = result.displayed_link?.includes('goodreads.com') ||
    result.displayed_link?.includes('amazon.') ||
    result.displayed_link?.includes('books.google') ||
    result.displayed_link?.includes('barnesandnoble') ||
    result.displayed_link?.includes('bookdepository') ||
    result.displayed_link?.includes('penguin') ||
    result.displayed_link?.includes('harpercollins') ||
    result.displayed_link?.includes('simonandschuster');

  if (!isBookSite) return null;

  let title = result.title
    .replace(/\s*[-–—|:]\s*(Goodreads|Amazon.*|Google Books|Barnes.*|Wikipedia|Penguin.*|HarperCollins.*|Simon.*)$/i, '')
    .replace(/\s*\(.*edition.*\)$/i, '')
    .replace(/\s*\|.*$/i, '')
    .trim();

  // Extract "Title by Author" pattern
  let creator: string | null = null;
  const byMatch = title.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    title = byMatch[1].trim();
    creator = byMatch[2].trim();
  }

  if (!creator && result.snippet) {
    const authorMatch = result.snippet.match(/by\s+([A-Z][a-zA-Z\s.''-]+?)(?:\s*[-–—·|,]|\s*\d{4}|\.\.\.|$)/);
    if (authorMatch) creator = authorMatch[1].trim();
  }

  if (!title || title.length < 2) return null;

  let year: number | null = null;
  const yearMatch = result.snippet?.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) year = parseInt(yearMatch[0]);

  const rating = result.rich_snippet?.top?.detected_extensions?.rating || 0;
  const reviews = result.rich_snippet?.top?.detected_extensions?.reviews || 0;

  return {
    title,
    creator,
    year,
    description: result.snippet?.slice(0, 300) || '',
    rating,
    vote_count: reviews,
  };
}

async function seedFromQuery(query: string): Promise<{ inserted: number; skipped: number }> {
  const results = await serpSearch(query);
  let inserted = 0, skipped = 0;

  for (const result of results) {
    const book = parseBookFromResult(result);
    if (!book) continue;

    const externalId = `serp_${book.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 60)}`;

    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('external_id', externalId)
      .eq('external_source', 'serpapi')
      .single();

    if (existing) { skipped++; continue; }

    // Also check by title to avoid duplicates from other sources
    const { data: titleMatch } = await supabase
      .from('items')
      .select('id')
      .ilike('title', book.title)
      .in('category', ['books', 'fiction_books', 'nonfiction_books'])
      .limit(1);

    if (titleMatch && titleMatch.length > 0) { skipped++; continue; }

    const { error } = await supabase.from('items').insert({
      category: 'books',
      external_id: externalId,
      external_source: 'serpapi',
      title: book.title,
      creator: book.creator,
      description: book.description,
      genres: [],
      year: book.year,
      image_url: null,
      metadata: {
        serp_rating: book.rating,
        serp_reviews: book.vote_count,
      },
    });

    if (!error) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}

async function main() {
  // Curated queries designed to maximise book discovery per search
  const queries = [
    // Bestseller lists
    'new york times bestseller fiction 2024 2025',
    'new york times bestseller nonfiction 2024 2025',
    'sunday times bestseller books 2024',
    'amazon best selling books 2024 2025',
    'goodreads choice awards 2024 winners',
    'goodreads best books 2023 2024',

    // Award winners
    'booker prize winners all time list',
    'pulitzer prize fiction winners list',
    'national book award winners list',
    'hugo award best novel winners',
    'nebula award winners science fiction',
    'women prize for fiction winners',
    'costa book award winners',

    // Genre bestsellers
    'best thriller novels of all time list',
    'best science fiction books of all time',
    'best fantasy series books of all time',
    'best mystery novels of all time',
    'best romance novels popular',
    'best horror novels of all time',
    'best historical fiction novels',
    'best dystopian novels list',

    // Popular nonfiction
    'best self help books of all time',
    'best business books of all time',
    'best psychology books popular',
    'best biography autobiography books',
    'best true crime books',
    'best science books popular',
    'best philosophy books beginners',
    'best history books popular',
    'best memoirs of all time',
    'best personal finance investing books',

    // Modern popular
    'most popular books on tiktok booktok',
    'reese witherspoon book club picks all',
    'oprah book club picks all time',
    'bill gates recommended books',
    'barack obama recommended books list',

    // Australian/regional
    'best australian novels',
    'miles franklin award winners',
    'best british novels',

    // Series
    'best book series for adults',
    'best completed book series',
    'best young adult book series',

    // Trending
    'most anticipated books 2025 2026',
    'best books released 2024',
    'viral books social media 2024',
  ];

  let totalInserted = 0, totalSkipped = 0, searchesUsed = 0;

  for (const query of queries) {
    const { inserted, skipped } = await seedFromQuery(query);
    totalInserted += inserted;
    totalSkipped += skipped;
    searchesUsed++;
    process.stdout.write(`\r[${searchesUsed}/${queries.length}] ${totalInserted} inserted, ${totalSkipped} skipped — ${query.slice(0, 50)}`);

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n\nDone: ${totalInserted} inserted, ${totalSkipped} skipped, ${searchesUsed} SerpAPI searches used`);
}

main().catch(console.error);
