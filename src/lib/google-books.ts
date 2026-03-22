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

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) {
    throw new Error(`Google Books API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function getBookCover(imageLinks?: { thumbnail?: string; smallThumbnail?: string }): string | null {
  if (!imageLinks) return null;
  // Use thumbnail and upgrade to https
  const url = imageLinks.thumbnail || imageLinks.smallThumbnail;
  return url ? url.replace('http://', 'https://') : null;
}

function mapVolume(v: GoogleBooksVolume, category: 'fiction_books' | 'nonfiction_books') {
  const info = v.volumeInfo;
  const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null;

  return {
    external_id: v.id,
    external_source: 'google_books' as const,
    category,
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

// --- Fiction Books ---

export async function searchFictionBooks(query: string) {
  // Search without subject filter first for better coverage
  const data = await booksFetch<{ items?: GoogleBooksVolume[] }>('/volumes', {
    q: query,
    maxResults: '20',
    orderBy: 'relevance',
    langRestrict: 'en',
  });

  return (data.items || []).map((v) => mapVolume(v, 'fiction_books'));
}

export async function getPopularFictionBooks(page = 1) {
  const subjects = [
    'literary fiction', 'thriller fiction', 'science fiction',
    'fantasy fiction', 'mystery fiction', 'historical fiction',
    'romance fiction', 'horror fiction',
  ];
  const subject = subjects[(page - 1) % subjects.length];

  const data = await booksFetch<{ items?: GoogleBooksVolume[] }>('/volumes', {
    q: `subject:${subject}`,
    maxResults: '20',
    orderBy: 'relevance',
    langRestrict: 'en',
  });

  return (data.items || []).map((v) => mapVolume(v, 'fiction_books'));
}

// --- Non-Fiction Books ---

export async function searchNonfictionBooks(query: string) {
  const data = await booksFetch<{ items?: GoogleBooksVolume[] }>('/volumes', {
    q: query,
    maxResults: '20',
    orderBy: 'relevance',
    langRestrict: 'en',
  });

  return (data.items || []).map((v) => mapVolume(v, 'nonfiction_books'));
}

export async function getPopularNonfictionBooks(page = 1) {
  const subjects = [
    'science', 'history', 'biography', 'psychology',
    'philosophy', 'business', 'politics', 'self-help',
  ];
  const subject = subjects[(page - 1) % subjects.length];

  const data = await booksFetch<{ items?: GoogleBooksVolume[] }>('/volumes', {
    q: `subject:${subject}`,
    maxResults: '20',
    orderBy: 'relevance',
    langRestrict: 'en',
  });

  return (data.items || []).map((v) => mapVolume(v, 'nonfiction_books'));
}

// --- Genre lists ---

export function getFictionGenres(): string[] {
  return [
    'Literary Fiction', 'Thriller', 'Science Fiction', 'Fantasy',
    'Mystery', 'Historical Fiction', 'Romance', 'Horror',
    'Dystopian', 'Satire', 'Magical Realism', 'Adventure',
  ];
}

export function getNonfictionGenres(): string[] {
  return [
    'Science', 'History', 'Biography', 'Psychology',
    'Philosophy', 'Business', 'Politics', 'Self-Help',
    'True Crime', 'Nature', 'Technology', 'Sociology',
    'Economics', 'Memoir', 'Travel', 'Health',
  ];
}
