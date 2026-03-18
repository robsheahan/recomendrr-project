-- Enums
CREATE TYPE media_category AS ENUM (
  'fiction_books',
  'nonfiction_books',
  'documentaries',
  'tv_shows',
  'movies',
  'podcasts',
  'music_artists'
);

CREATE TYPE rating_source AS ENUM ('onboarding', 'recommendation', 'manual');

CREATE TYPE recommendation_status AS ENUM (
  'pending',
  'saved',
  'dismissed',
  'not_interested',
  'rated'
);

CREATE TYPE signal_strength AS ENUM ('high', 'medium', 'low');

CREATE TYPE user_tier AS ENUM ('free', 'paid');

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  tier user_tier NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  monthly_request_count INT NOT NULL DEFAULT 0,
  monthly_request_limit INT DEFAULT 10,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User categories
CREATE TABLE user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category media_category NOT NULL,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category)
);

-- Items (media items from external APIs)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category media_category NOT NULL,
  external_id TEXT NOT NULL,
  external_source TEXT NOT NULL,
  title TEXT NOT NULL,
  creator TEXT,
  description TEXT,
  genres TEXT[] DEFAULT '{}',
  year INT,
  image_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, external_id, external_source)
);

-- Ratings
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  source rating_source NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);

-- Recommendations
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  status recommendation_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  model_used TEXT,
  batch_id UUID,
  recommended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recommendation cooldowns
CREATE TABLE recommendation_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  last_recommended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  times_recommended INT NOT NULL DEFAULT 1,
  UNIQUE (user_id, item_id)
);

-- Onboarding pool (curated items for onboarding)
CREATE TABLE onboarding_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category media_category NOT NULL,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  signal_strength signal_strength NOT NULL DEFAULT 'medium',
  display_order INT NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_user_categories_user ON user_categories(user_id);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_external ON items(external_id, external_source);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_item ON ratings(item_id);
CREATE INDEX idx_recommendations_user ON recommendations(user_id);
CREATE INDEX idx_recommendations_status ON recommendations(user_id, status);
CREATE INDEX idx_recommendations_batch ON recommendations(batch_id);
CREATE INDEX idx_cooldowns_user_item ON recommendation_cooldowns(user_id, item_id);
CREATE INDEX idx_onboarding_pool_category ON onboarding_pool(category);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_pool ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own record
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid() = id);

-- User categories: own data only
CREATE POLICY "Users can view own categories"
  ON user_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories"
  ON user_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories"
  ON user_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories"
  ON user_categories FOR DELETE USING (auth.uid() = user_id);

-- Items: readable by all authenticated users
CREATE POLICY "Items are viewable by authenticated users"
  ON items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Items can be inserted by authenticated users"
  ON items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Ratings: own data only
CREATE POLICY "Users can view own ratings"
  ON ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ratings"
  ON ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings"
  ON ratings FOR UPDATE USING (auth.uid() = user_id);

-- Recommendations: own data only
CREATE POLICY "Users can view own recommendations"
  ON recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recommendations"
  ON recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recommendations"
  ON recommendations FOR UPDATE USING (auth.uid() = user_id);

-- Cooldowns: own data only
CREATE POLICY "Users can view own cooldowns"
  ON recommendation_cooldowns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own cooldowns"
  ON recommendation_cooldowns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cooldowns"
  ON recommendation_cooldowns FOR UPDATE USING (auth.uid() = user_id);

-- Onboarding pool: readable by all authenticated users
CREATE POLICY "Onboarding pool is viewable by authenticated users"
  ON onboarding_pool FOR SELECT USING (auth.role() = 'authenticated');

-- Function: auto-create user record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: create user record on auth signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
