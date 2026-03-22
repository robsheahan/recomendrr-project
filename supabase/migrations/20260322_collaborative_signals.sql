-- Item reputation: aggregated feedback across all users
CREATE TABLE IF NOT EXISTS item_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  times_recommended INT NOT NULL DEFAULT 0,
  thumbs_up INT NOT NULL DEFAULT 0,
  thumbs_down INT NOT NULL DEFAULT 0,
  avg_post_rating NUMERIC(3,1),
  total_ratings INT NOT NULL DEFAULT 0,
  avg_user_rating NUMERIC(3,1),
  hit_rate NUMERIC(3,2), -- thumbs_up / (thumbs_up + thumbs_down)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id)
);

-- Taste similarity cache between users
CREATE TABLE IF NOT EXISTS taste_similarity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  similarity_score NUMERIC(4,3) NOT NULL, -- 0.000 to 1.000
  shared_items INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_a, user_b)
);

-- Collaborative recommendations: items loved by similar users
CREATE TABLE IF NOT EXISTS collaborative_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  source_user_count INT NOT NULL DEFAULT 0, -- how many similar users rated this highly
  avg_similarity NUMERIC(4,3) NOT NULL, -- avg similarity of those users
  avg_rating NUMERIC(3,1) NOT NULL, -- avg rating from similar users
  signal_strength NUMERIC(4,3) NOT NULL, -- composite score
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_user_id, item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_reputation_item ON item_reputation(item_id);
CREATE INDEX IF NOT EXISTS idx_item_reputation_hit_rate ON item_reputation(hit_rate DESC);
CREATE INDEX IF NOT EXISTS idx_taste_similarity_user_a ON taste_similarity(user_a);
CREATE INDEX IF NOT EXISTS idx_taste_similarity_user_b ON taste_similarity(user_b);
CREATE INDEX IF NOT EXISTS idx_taste_similarity_score ON taste_similarity(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_collaborative_signals_user ON collaborative_signals(target_user_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_signals_strength ON collaborative_signals(target_user_id, signal_strength DESC);

-- RLS
ALTER TABLE item_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE taste_similarity ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_signals ENABLE ROW LEVEL SECURITY;

-- Item reputation: readable by all authenticated users
CREATE POLICY "Item reputation viewable by authenticated users"
  ON item_reputation FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Item reputation insertable by authenticated users"
  ON item_reputation FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Item reputation updatable by authenticated users"
  ON item_reputation FOR UPDATE USING (auth.role() = 'authenticated');

-- Taste similarity: users can see their own similarities
CREATE POLICY "Users can view own similarities"
  ON taste_similarity FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Similarity insertable by authenticated users"
  ON taste_similarity FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Similarity updatable by authenticated users"
  ON taste_similarity FOR UPDATE USING (auth.role() = 'authenticated');

-- Collaborative signals: own data only
CREATE POLICY "Users can view own collaborative signals"
  ON collaborative_signals FOR SELECT USING (auth.uid() = target_user_id);
CREATE POLICY "Collaborative signals insertable by authenticated users"
  ON collaborative_signals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Collaborative signals updatable by authenticated users"
  ON collaborative_signals FOR UPDATE USING (auth.role() = 'authenticated');
