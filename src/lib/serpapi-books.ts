const SERPAPI_BASE = 'https://serpapi.com/search.json';

interface SerpAPIOrganicResult {
  title: string;
  link: string;
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

interface SerpAPIResponse {
  organic_results?: SerpAPIOrganicResult[];
  knowledge_graph?: {
    title?: string;
    description?: string;
    type?: string;
    image?: string;
    books_or_works?: { title: string; year: string }[];
  };
}

function getApiKey() {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error('SERPAPI_API_KEY is not set');
  return key;
}

export async function searchBooksViaSerpAPI(query: string) {
  const params = new URLSearchParams({
    api_key: getApiKey(),
    engine: 'google',
    q: `${query} book`,
    num: '10',
  });

  const res = await fetch(`${SERPAPI_BASE}?${params}`, { cache: 'no-store' });
  if (!res.ok) return [];

  const data: SerpAPIResponse = await res.json();
  const results: {
    external_id: string;
    external_source: string;
    category: string;
    title: string;
    creator: string | null;
    description: string;
    genres: string[];
    year: number | null;
    image_url: string | null;
    rating: number;
    vote_count: number;
  }[] = [];

  // Parse organic results for book info
  for (const result of data.organic_results || []) {
    // Skip non-book results
    const isBookSite = result.displayed_link?.includes('goodreads.com') ||
      result.displayed_link?.includes('amazon.') ||
      result.displayed_link?.includes('books.google') ||
      result.displayed_link?.includes('bookdepository') ||
      result.displayed_link?.includes('barnesandnoble');

    if (!isBookSite && !result.title.toLowerCase().includes('book')) continue;

    // Extract title - clean up common suffixes
    let title = result.title
      .replace(/\s*[-–—|:]\s*(Goodreads|Amazon.*|Google Books|Book Depository|Barnes.*|Wikipedia).*$/i, '')
      .replace(/\s*\(.*edition.*\)$/i, '')
      .replace(/\s*by\s+.*$/i, '')
      .trim();

    if (!title || title.length < 2) continue;

    // Try to extract author from snippet
    let creator: string | null = null;
    const authorMatch = result.snippet?.match(/by\s+([A-Z][a-zA-Z\s.''-]+?)(?:\s*[-–—·|,]|\s*\d{4}|\.\.\.|$)/);
    if (authorMatch) creator = authorMatch[1].trim();

    // Extract year
    let year: number | null = null;
    const yearMatch = result.snippet?.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) year = parseInt(yearMatch[0]);

    // Extract rating from rich snippet
    const rating = result.rich_snippet?.top?.detected_extensions?.rating || 0;
    const reviews = result.rich_snippet?.top?.detected_extensions?.reviews || 0;

    // Generate a stable ID from the title
    const externalId = `serp_${title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50)}`;

    // Avoid duplicates
    if (results.some((r) => r.title.toLowerCase() === title.toLowerCase())) continue;

    results.push({
      external_id: externalId,
      external_source: 'serpapi',
      category: 'books',
      title,
      creator,
      description: result.snippet?.slice(0, 300) || '',
      genres: [],
      year,
      image_url: null,
      rating,
      vote_count: reviews,
    });
  }

  return results;
}
