-- Taste fingerprints (LLM-generated user taste analysis)
CREATE TABLE taste_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT, -- null means cross-category fingerprint
  fingerprint JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ratings_count_at_generation INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, category)
);

-- Recommendation feedback (good rec / bad rec signals)
ALTER TABLE recommendations
  ADD COLUMN feedback TEXT CHECK (feedback IN ('good', 'bad')),
  ADD COLUMN feedback_at TIMESTAMPTZ,
  ADD COLUMN intent TEXT; -- what the user was looking for when this was generated

-- Conversation sessions for refinement
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  intent TEXT,
  genre TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  batch_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_taste_fingerprints_user ON taste_fingerprints(user_id);
CREATE INDEX idx_conversation_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_recommendations_feedback ON recommendations(user_id, feedback);

-- RLS
ALTER TABLE taste_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fingerprints"
  ON taste_fingerprints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fingerprints"
  ON taste_fingerprints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fingerprints"
  ON taste_fingerprints FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own conversations"
  ON conversation_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations"
  ON conversation_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations"
  ON conversation_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_conversation_sessions_updated_at
  BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
