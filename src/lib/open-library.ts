const OL_SEARCH_URL = 'https://openlibrary.org/search.json';
const OL_COVER_URL = 'https://covers.openlibrary.org/b/olid';

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  subject?: string[];
  cover_edition_key?: string;
  edition_key?: string[];
  ratings_average?: number;
  ratings_count?: number;
}

function getCoverUrl(doc: OLDoc): string | null {
  const editionKey = doc.cover_edition_key || doc.edition_key?.[0];
  if (!editionKey) return null;
  return `${OL_COVER_URL}/${editionKey}-M.jpg`;
}

function mapDoc(doc: OLDoc) {
  const genres = (doc.subject || [])
    .filter((s) => s.length < 30) // Filter out overly long subjects
    .slice(0, 5);

  return {
    external_id: doc.key,
    external_source: 'open_library' as const,
    category: 'books' as const,
    title: doc.title,
    creator: doc.author_name?.join(', ') || null,
    description: '',
    genres,
    year: doc.first_publish_year || null,
    image_url: getCoverUrl(doc),
    rating: doc.ratings_average || 0,
    vote_count: doc.ratings_count || 0,
  };
}

export async function searchOpenLibrary(query: string) {
  const params = new URLSearchParams({
    q: query,
    limit: '10',
    language: 'eng',
    fields: 'key,title,author_name,first_publish_year,subject,cover_edition_key,edition_key,ratings_average,ratings_count',
  });

  const res = await fetch(`${OL_SEARCH_URL}?${params}`, { cache: 'no-store' });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.docs || []).map(mapDoc);
}
