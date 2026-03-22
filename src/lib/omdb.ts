const OMDB_BASE_URL = 'https://www.omdbapi.com';

export interface OMDBRatings {
  imdbRating: number | null;
  imdbVotes: number | null;
  rottenTomatoes: number | null; // percentage 0-100
  metascore: number | null;
  imdbId: string | null;
}

interface OMDBResponse {
  Response: string;
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Metascore?: string;
  Ratings?: { Source: string; Value: string }[];
}

function getApiKey() {
  const key = process.env.OMDB_API_KEY;
  if (!key) throw new Error('OMDB_API_KEY is not set');
  return key;
}

export async function fetchOMDBByTitle(
  title: string,
  year?: number | null
): Promise<OMDBRatings | null> {
  const params = new URLSearchParams({
    apikey: getApiKey(),
    t: title,
    type: 'movie',
  });
  if (year) params.set('y', String(year));

  const res = await fetch(`${OMDB_BASE_URL}?${params}`, { cache: 'no-store' });
  if (!res.ok) return null;

  const data: OMDBResponse = await res.json();
  if (data.Response !== 'True') return null;

  return parseOMDBResponse(data);
}

export async function fetchOMDBByIMDBId(imdbId: string): Promise<OMDBRatings | null> {
  const params = new URLSearchParams({
    apikey: getApiKey(),
    i: imdbId,
  });

  const res = await fetch(`${OMDB_BASE_URL}?${params}`, { cache: 'no-store' });
  if (!res.ok) return null;

  const data: OMDBResponse = await res.json();
  if (data.Response !== 'True') return null;

  return parseOMDBResponse(data);
}

function parseOMDBResponse(data: OMDBResponse): OMDBRatings {
  const imdbRating = data.imdbRating && data.imdbRating !== 'N/A'
    ? parseFloat(data.imdbRating)
    : null;

  const imdbVotes = data.imdbVotes && data.imdbVotes !== 'N/A'
    ? parseInt(data.imdbVotes.replace(/,/g, ''))
    : null;

  const metascore = data.Metascore && data.Metascore !== 'N/A'
    ? parseInt(data.Metascore)
    : null;

  let rottenTomatoes: number | null = null;
  if (data.Ratings) {
    const rt = data.Ratings.find((r) => r.Source === 'Rotten Tomatoes');
    if (rt) {
      rottenTomatoes = parseInt(rt.Value.replace('%', ''));
    }
  }

  return {
    imdbRating,
    imdbVotes,
    rottenTomatoes,
    metascore,
    imdbId: data.imdbID || null,
  };
}

// Composite quality score (0-10 scale)
export function computeQualityScore(ratings: OMDBRatings): number | null {
  const scores: number[] = [];

  if (ratings.imdbRating) scores.push(ratings.imdbRating);
  if (ratings.rottenTomatoes) scores.push(ratings.rottenTomatoes / 10); // Convert to 0-10
  if (ratings.metascore) scores.push(ratings.metascore / 10); // Convert to 0-10

  if (scores.length === 0) return null;

  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export function formatRatingsForDisplay(ratings: OMDBRatings): string {
  const parts: string[] = [];
  if (ratings.imdbRating) parts.push(`IMDB ${ratings.imdbRating}`);
  if (ratings.rottenTomatoes) parts.push(`RT ${ratings.rottenTomatoes}%`);
  return parts.join(' · ');
}
