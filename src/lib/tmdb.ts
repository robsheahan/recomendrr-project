const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
}

interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
}

interface TMDBMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
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
  vote_average: number;
  vote_count: number;
}

export const MOVIE_GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

export const TV_GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  10762: 'Kids', 9648: 'Mystery', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk',
  10768: 'War & Politics', 37: 'Western',
};

// Minimum TMDB rating to recommend (out of 10)
export const MIN_RATING_THRESHOLD = 6.0;
// Minimum number of votes for rating to be meaningful
export const MIN_VOTE_COUNT = 50;

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

// --- Genre lists ---

export async function getMovieGenres(): Promise<{ id: number; name: string }[]> {
  const data = await tmdbFetch<{ genres: { id: number; name: string }[] }>(
    '/genre/movie/list'
  );
  return data.genres;
}

export async function getTVGenres(): Promise<{ id: number; name: string }[]> {
  const data = await tmdbFetch<{ genres: { id: number; name: string }[] }>(
    '/genre/tv/list'
  );
  return data.genres;
}

export async function getGenresForCategory(category: string): Promise<string[]> {
  switch (category) {
    case 'movies':
      return [...Object.values(MOVIE_GENRE_MAP).filter((g) => g !== 'TV Movie'), 'Documentary'];
    case 'tv_shows':
      return [...Object.values(TV_GENRE_MAP).filter((g) => g !== 'News' && g !== 'Soap'), 'Documentary'];
    case 'books':
    case 'fiction_books':
    case 'nonfiction_books': {
      const { getBookGenres } = await import('./google-books');
      return getBookGenres();
    }
    case 'music_artists': {
      const { getMusicGenres } = await import('./spotify');
      return getMusicGenres();
    }
    case 'podcasts': {
      const { getPodcastGenres } = await import('./spotify');
      return getPodcastGenres();
    }
    default:
      return [];
  }
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
    rating: data.vote_average,
    vote_count: data.vote_count,
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
    rating: m.vote_average,
    vote_count: m.vote_count,
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
    rating: data.vote_average,
    vote_count: data.vote_count,
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
    rating: t.vote_average,
    vote_count: t.vote_count,
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
  rating: number;
  vote_count: number;
  metadata?: Record<string, unknown>;
};

export async function getPopularByCategory(
  category: string,
  page = 1
): Promise<MediaItemData[]> {
  // Lazy imports to avoid loading unused API clients
  switch (category) {
    case 'movies':
      return getPopularMovies(page);
    case 'tv_shows':
      return getPopularTVShows(page);
    case 'books':
    case 'fiction_books':
    case 'nonfiction_books': {
      const { getPopularBooks } = await import('./google-books');
      return getPopularBooks(page);
    }
    case 'music_artists': {
      const { getPopularMusicArtists } = await import('./spotify');
      return getPopularMusicArtists(page);
    }
    case 'podcasts': {
      const { getPopularPodcasts } = await import('./spotify');
      return getPopularPodcasts(page);
    }
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
    case 'books':
    case 'fiction_books':
    case 'nonfiction_books': {
      const { searchBooks } = await import('./google-books');
      return searchBooks(query);
    }
    case 'music_artists': {
      const { searchMusicArtists } = await import('./spotify');
      return searchMusicArtists(query);
    }
    case 'podcasts': {
      const { searchPodcasts } = await import('./spotify');
      return searchPodcasts(query);
    }
    case 'documentaries':
      return searchDocumentaries(query);
    default:
      return [];
  }
}
