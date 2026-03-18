const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  genre_ids: number[];
}

interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  genre_ids: number[];
}

interface TMDBMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  genres: { id: number; name: string }[];
  credits?: {
    crew: { job: string; name: string }[];
  };
}

interface TMDBTVDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  created_by: { name: string }[];
}

const MOVIE_GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

const TV_GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  10762: 'Kids', 9648: 'Mystery', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk',
  10768: 'War & Politics', 37: 'Western',
};

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY is not set');
  return key;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', getApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function getImageUrl(path: string | null): string | null {
  return path ? `${TMDB_IMAGE_BASE}${path}` : null;
}

// --- Movies ---

export async function getPopularMovies(page = 1) {
  const data = await tmdbFetch<{ results: TMDBMovie[]; total_pages: number }>(
    '/movie/popular',
    { page: String(page) }
  );
  return data.results.map(mapMovie);
}

export async function getTopRatedMovies(page = 1) {
  const data = await tmdbFetch<{ results: TMDBMovie[]; total_pages: number }>(
    '/movie/top_rated',
    { page: String(page) }
  );
  return data.results.map(mapMovie);
}

export async function searchMovies(query: string) {
  const data = await tmdbFetch<{ results: TMDBMovie[] }>(
    '/search/movie',
    { query }
  );
  return data.results.map(mapMovie);
}

export async function getMovieDetails(tmdbId: number) {
  const data = await tmdbFetch<TMDBMovieDetails>(
    `/movie/${tmdbId}`,
    { append_to_response: 'credits' }
  );
  const director = data.credits?.crew.find((c) => c.job === 'Director')?.name ?? null;
  return {
    external_id: String(data.id),
    external_source: 'tmdb' as const,
    category: 'movies' as const,
    title: data.title,
    creator: director,
    description: data.overview,
    genres: data.genres.map((g) => g.name),
    year: data.release_date ? parseInt(data.release_date.slice(0, 4)) : null,
    image_url: getImageUrl(data.poster_path),
  };
}

function mapMovie(m: TMDBMovie) {
  return {
    external_id: String(m.id),
    external_source: 'tmdb' as const,
    category: 'movies' as const,
    title: m.title,
    description: m.overview,
    genres: m.genre_ids.map((id) => MOVIE_GENRE_MAP[id]).filter(Boolean),
    year: m.release_date ? parseInt(m.release_date.slice(0, 4)) : null,
    image_url: getImageUrl(m.poster_path),
    creator: null,
  };
}

// --- TV Shows ---

export async function getPopularTVShows(page = 1) {
  const data = await tmdbFetch<{ results: TMDBTVShow[]; total_pages: number }>(
    '/tv/popular',
    { page: String(page) }
  );
  return data.results.map(mapTVShow);
}

export async function getTopRatedTVShows(page = 1) {
  const data = await tmdbFetch<{ results: TMDBTVShow[]; total_pages: number }>(
    '/tv/top_rated',
    { page: String(page) }
  );
  return data.results.map(mapTVShow);
}

export async function searchTVShows(query: string) {
  const data = await tmdbFetch<{ results: TMDBTVShow[] }>(
    '/search/tv',
    { query }
  );
  return data.results.map(mapTVShow);
}

export async function getTVShowDetails(tmdbId: number) {
  const data = await tmdbFetch<TMDBTVDetails>(`/tv/${tmdbId}`);
  const creator = data.created_by?.[0]?.name ?? null;
  return {
    external_id: String(data.id),
    external_source: 'tmdb' as const,
    category: 'tv_shows' as const,
    title: data.name,
    creator,
    description: data.overview,
    genres: data.genres.map((g) => g.name),
    year: data.first_air_date ? parseInt(data.first_air_date.slice(0, 4)) : null,
    image_url: getImageUrl(data.poster_path),
    metadata: { number_of_seasons: data.number_of_seasons },
  };
}

function mapTVShow(t: TMDBTVShow) {
  return {
    external_id: String(t.id),
    external_source: 'tmdb' as const,
    category: 'tv_shows' as const,
    title: t.name,
    description: t.overview,
    genres: t.genre_ids.map((id) => TV_GENRE_MAP[id]).filter(Boolean),
    year: t.first_air_date ? parseInt(t.first_air_date.slice(0, 4)) : null,
    image_url: getImageUrl(t.poster_path),
    creator: null,
  };
}

// --- Documentaries ---

export async function getPopularDocumentaries(page = 1) {
  const data = await tmdbFetch<{ results: TMDBMovie[]; total_pages: number }>(
    '/discover/movie',
    { with_genres: '99', sort_by: 'popularity.desc', page: String(page) }
  );
  return data.results.map((m) => ({
    ...mapMovie(m),
    category: 'documentaries' as const,
  }));
}

export async function searchDocumentaries(query: string) {
  const movies = await searchMovies(query);
  return movies
    .filter((m) => m.genres.includes('Documentary'))
    .map((m) => ({ ...m, category: 'documentaries' as const }));
}

// --- Search dispatcher ---

export type MediaItemData = {
  external_id: string;
  external_source: string;
  category: string;
  title: string;
  creator: string | null;
  description: string;
  genres: string[];
  year: number | null;
  image_url: string | null;
  metadata?: Record<string, unknown>;
};

export async function getPopularByCategory(
  category: string,
  page = 1
): Promise<MediaItemData[]> {
  switch (category) {
    case 'movies':
      return getPopularMovies(page);
    case 'tv_shows':
      return getPopularTVShows(page);
    case 'documentaries':
      return getPopularDocumentaries(page);
    default:
      return [];
  }
}

export async function searchByCategory(
  category: string,
  query: string
): Promise<MediaItemData[]> {
  switch (category) {
    case 'movies':
      return searchMovies(query);
    case 'tv_shows':
      return searchTVShows(query);
    case 'documentaries':
      return searchDocumentaries(query);
    default:
      return [];
  }
}
