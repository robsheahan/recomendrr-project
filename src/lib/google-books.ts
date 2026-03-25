const BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1';

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    categories?: string[];
    publishedDate?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    averageRating?: number;
    ratingsCount?: number;
  };
}

function getApiKey() {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) throw new Error('GOOGLE_BOOKS_API_KEY is not set');
  return key;
}

async function booksFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BOOKS_BASE_URL}${path}`);
  url.searchParams.set('key', getApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Google Books API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function getBookCover(imageLinks?: { thumbnail?: string; smallThumbnail?: string }): string | null {
  if (!imageLinks) return null;
  const url = imageLinks.thumbnail || imageLinks.smallThumbnail;
  return url ? url.replace('http://', 'https://') : null;
}

function mapVolume(v: GoogleBooksVolume) {
  const info = v.volumeInfo;
  const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null;

  return {
    external_id: v.id,
    external_source: 'google_books' as const,
    category: 'books' as const,
    title: info.title,
    creator: info.authors?.join(', ') || null,
    description: info.description || '',
    genres: info.categories || [],
    year: isNaN(year as number) ? null : year,
    image_url: getBookCover(info.imageLinks),
    rating: info.averageRating || 0,
    vote_count: info.ratingsCount || 0,
  };
}

// --- Search (Google Books + Open Library fallback) ---

export async function searchBooks(query: string) {
  // Filter out obvious junk from Google Books
  function isValidBook(v: GoogleBooksVolume): boolean {
    const info = v.volumeInfo;
    if (!info.title || info.title.length < 2) return false;
    // Filter academic papers, periodicals, reports
    const junkPatterns = /^(proceedings|bulletin|report|journal|transactions|annals|dictionary of|encyclopedia|handbook of|quarterly|monthly|review of|advances in)/i;
    if (junkPatterns.test(info.title)) return false;
    // Must have at least an author
    if (!info.authors || info.authors.length === 0) return false;
    return true;
  }

  // Search Google Books first
  const data = await booksFetch<{ items?: GoogleBooksVolume[] }>('/volumes', {
    q: query,
    maxResults: '20',
    orderBy: 'relevance',
    langRestrict: 'en',
  });

  const googleResults = (data.items || []).filter(isValidBook).map(mapVolume);

  // If few results, supplement with Open Library
  if (googleResults.length < 5) {
    try {
      const { searchOpenLibrary } = await import('./open-library');
      const olResults = await searchOpenLibrary(query);
      const googleTitles = new Set(googleResults.map((r) => r.title.toLowerCase()));
      const newResults = olResults.filter(
        (r: { title: string }) => !googleTitles.has(r.title.toLowerCase())
      );
      return [...googleResults, ...newResults].slice(0, 15);
    } catch {
      // Open Library failed, return what we have
    }
  }

  return googleResults;
}

// --- Popular books for onboarding ---

export async function getPopularBooks(page = 1) {
  const subjects = [
    'bestseller', 'thriller', 'science fiction', 'fantasy',
    'mystery', 'historical fiction', 'romance', 'biography',
    'science', 'psychology', 'history', 'philosophy',
    'self-help', 'business', 'true crime', 'adventure',
  ];
  const subject = subjects[(page - 1) % subjects.length];

  const data = await booksFetch<{ items?: GoogleBooksVolume[] }>('/volumes', {
    q: `subject:${subject}`,
    maxResults: '20',
    orderBy: 'relevance',
    langRestrict: 'en',
  });

  return (data.items || []).map(mapVolume);
}

// --- Combined genre list ---

export function getBookGenres(): string[] {
  return [
    // Fiction
    'Literary Fiction', 'Thriller', 'Science Fiction', 'Fantasy',
    'Mystery', 'Historical Fiction', 'Romance', 'Horror',
    'Dystopian', 'Adventure', 'Magical Realism', 'Satire',
    // Non-Fiction
    'Science', 'History', 'Biography', 'Psychology',
    'Philosophy', 'Business', 'Politics', 'Self-Help',
    'True Crime', 'Nature', 'Technology', 'Sociology',
    'Economics', 'Memoir', 'Health', 'Travel',
  ];
}

// Legacy exports for backward compatibility
export const searchFictionBooks = searchBooks;
export const searchNonfictionBooks = searchBooks;
export const getPopularFictionBooks = getPopularBooks;
export const getPopularNonfictionBooks = getPopularBooks;
export const getFictionGenres = getBookGenres;
export const getNonfictionGenres = getBookGenres;
