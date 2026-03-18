import { MediaCategory } from '@/types/database';

export const CATEGORY_LABELS: Record<MediaCategory, string> = {
  fiction_books: 'Fiction Books',
  nonfiction_books: 'Non-Fiction Books',
  documentaries: 'Documentaries',
  tv_shows: 'TV Shows',
  movies: 'Movies',
  podcasts: 'Podcasts',
  music_artists: 'Music Artists',
};

export const CATEGORY_ICONS: Record<MediaCategory, string> = {
  fiction_books: '📚',
  nonfiction_books: '📖',
  documentaries: '🎬',
  tv_shows: '📺',
  movies: '🎥',
  podcasts: '🎙️',
  music_artists: '🎵',
};

export const ONBOARDING_RATINGS_REQUIRED = 15;
export const FREE_TIER_MONTHLY_LIMIT = 10;
export const COOLDOWN_DAYS = 30;
export const MAX_RECOMMENDATION_COUNT = 3;
export const RECOMMENDATIONS_PER_REQUEST = 3;
