import { MediaCategory } from '@/types/database';

// Active categories shown in the UI
export const ACTIVE_CATEGORIES: MediaCategory[] = [
  'movies',
  'tv_shows',
  'books',
  'podcasts',
  'music_artists',
];

export const CATEGORY_LABELS: Record<string, string> = {
  movies: 'Movies',
  tv_shows: 'TV Shows',
  books: 'Books',
  podcasts: 'Podcasts',
  music_artists: 'Music Artists',
  // Legacy
  fiction_books: 'Books',
  nonfiction_books: 'Books',
  documentaries: 'Movies',
};

// Maps new categories to legacy DB values they should include when querying
export const CATEGORY_DB_MAP: Record<string, string[]> = {
  movies: ['movies', 'documentaries'],
  tv_shows: ['tv_shows'],
  books: ['books', 'fiction_books', 'nonfiction_books'],
  podcasts: ['podcasts'],
  music_artists: ['music_artists'],
};

export const ONBOARDING_RATINGS_REQUIRED = 15;
export const FREE_TIER_MONTHLY_LIMIT = 10;
export const COOLDOWN_DAYS = 30;
export const MAX_RECOMMENDATION_COUNT = 3;
export const RECOMMENDATIONS_PER_REQUEST = 3;
