const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  }

  const res = await fetch(SPOTIFY_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Spotify auth error: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
  };

  return cachedToken.token;
}

async function spotifyFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${SPOTIFY_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Music Artists ---

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string; width: number }[];
  popularity: number;
  followers: { total: number };
}

function mapArtist(a: SpotifyArtist) {
  const image = a.images.sort((x, y) => y.width - x.width)[0];
  return {
    external_id: a.id,
    external_source: 'spotify' as const,
    category: 'music_artists' as const,
    title: a.name,
    creator: null,
    description: `${a.genres.slice(0, 3).join(', ')} artist`,
    genres: a.genres.slice(0, 5),
    year: null,
    image_url: image?.url || null,
    rating: a.popularity / 10, // Convert 0-100 to 0-10 scale
    vote_count: a.followers.total,
    metadata: { popularity: a.popularity, followers: a.followers.total },
  };
}

export async function searchMusicArtists(query: string) {
  const data = await spotifyFetch<{
    artists: { items: (SpotifyArtist | null)[] };
  }>('/search', {
    q: query,
    type: 'artist',
    limit: '10',
  });

  return (data.artists?.items || [])
    .filter((a): a is SpotifyArtist => a !== null)
    .map(mapArtist);
}

export async function getPopularMusicArtists(page = 1) {
  // Spotify doesn't have a "popular artists" endpoint, so search by genre
  const genres = [
    'rock', 'pop', 'hip hop', 'electronic', 'jazz',
    'r&b', 'indie', 'classical', 'metal', 'folk',
    'country', 'soul', 'punk', 'blues', 'reggae',
    'alternative',
  ];
  const genre = genres[(page - 1) % genres.length];

  const data = await spotifyFetch<{
    artists: { items: (SpotifyArtist | null)[] };
  }>('/search', {
    q: `genre:${genre}`,
    type: 'artist',
    limit: '10',
  });

  return (data.artists?.items || [])
    .filter((a): a is SpotifyArtist => a !== null)
    .sort((a, b) => b.popularity - a.popularity)
    .map(mapArtist);
}

// --- Podcasts ---

interface SpotifyShow {
  id: string;
  name: string;
  publisher: string;
  description: string;
  images: { url: string; width: number }[];
  total_episodes: number;
  media_type: string;
}

function mapPodcast(s: SpotifyShow) {
  const image = s.images.sort((x, y) => y.width - x.width)[0];
  return {
    external_id: s.id,
    external_source: 'spotify' as const,
    category: 'podcasts' as const,
    title: s.name,
    creator: s.publisher,
    description: s.description,
    genres: [] as string[], // Spotify doesn't return genres for shows
    year: null,
    image_url: image?.url || null,
    rating: 0,
    vote_count: 0,
    metadata: { total_episodes: s.total_episodes },
  };
}

export async function searchPodcasts(query: string) {
  const data = await spotifyFetch<{
    shows: { items: (SpotifyShow | null)[] };
  }>('/search', {
    q: query,
    type: 'show',
    limit: '10',
    market: 'AU',
  });

  return (data.shows?.items || [])
    .filter((s): s is SpotifyShow => s !== null)
    .map(mapPodcast);
}

export async function getPopularPodcasts(page = 1) {
  // Use broad queries that return well-known, recognisable podcasts
  const queries = [
    'podcast',
    'top podcast',
    'best podcast',
    'popular podcast',
    'true crime podcast',
    'comedy podcast',
  ];
  const query = queries[(page - 1) % queries.length];

  const data = await spotifyFetch<{
    shows: { items: (SpotifyShow | null)[] };
  }>('/search', {
    q: query,
    type: 'show',
    limit: '10',
    market: 'AU',
  });

  return (data.shows?.items || [])
    .filter((s): s is SpotifyShow => s !== null)
    .map(mapPodcast);
}

// --- Genre lists ---

export function getMusicGenres(): string[] {
  return [
    'Rock', 'Pop', 'Hip Hop', 'Electronic', 'Jazz',
    'R&B', 'Indie', 'Classical', 'Metal', 'Folk',
    'Country', 'Soul', 'Punk', 'Blues', 'Reggae',
    'Alternative', 'Latin', 'World',
  ];
}

export function getPodcastGenres(): string[] {
  return [
    'True Crime', 'Comedy', 'News', 'Science', 'History',
    'Business', 'Technology', 'Culture', 'Storytelling',
    'Interview', 'Politics', 'Health', 'Sports',
    'Education', 'Society', 'Music',
  ];
}
