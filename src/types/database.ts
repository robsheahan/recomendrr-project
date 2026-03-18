export type MediaCategory =
  | 'fiction_books'
  | 'nonfiction_books'
  | 'documentaries'
  | 'tv_shows'
  | 'movies'
  | 'podcasts'
  | 'music_artists';

export type RatingSource = 'onboarding' | 'recommendation' | 'manual';

export type RecommendationStatus =
  | 'pending'
  | 'saved'
  | 'dismissed'
  | 'not_interested'
  | 'rated';

export type SignalStrength = 'high' | 'medium' | 'low';

export type UserTier = 'free' | 'paid';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  tier: UserTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  monthly_request_count: number;
  monthly_request_limit: number | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCategory {
  id: string;
  user_id: string;
  category: MediaCategory;
  onboarding_complete: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  category: MediaCategory;
  external_id: string;
  external_source: string;
  title: string;
  creator: string | null;
  description: string | null;
  genres: string[];
  year: number | null;
  image_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  item_id: string;
  score: number;
  source: RatingSource;
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  id: string;
  user_id: string;
  item_id: string;
  status: RecommendationStatus;
  reason: string | null;
  model_used: string | null;
  batch_id: string | null;
  recommended_at: string;
  status_changed_at: string | null;
  created_at: string;
}

export interface RecommendationCooldown {
  id: string;
  user_id: string;
  item_id: string;
  last_recommended_at: string;
  times_recommended: number;
}

export interface OnboardingPoolItem {
  id: string;
  category: MediaCategory;
  item_id: string;
  signal_strength: SignalStrength;
  display_order: number;
}

// Joined types for API responses
export interface RatingWithItem extends Rating {
  item: Item;
}

export interface RecommendationWithItem extends Recommendation {
  item: Item;
}
