-- Confidence and post-consumption tracking on recommendations
DO $$ BEGIN
  ALTER TABLE recommendations ADD COLUMN confidence TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE recommendations ADD COLUMN feedback_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE recommendations ADD COLUMN post_rating INT CHECK (post_rating >= 1 AND post_rating <= 5);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Fingerprint evolution fields
DO $$ BEGIN
  ALTER TABLE taste_fingerprints ADD COLUMN fingerprint_version INT NOT NULL DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE taste_fingerprints ADD COLUMN evolution_notes TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE taste_fingerprints ADD COLUMN miss_analysis JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE taste_fingerprints ADD COLUMN taste_thesis TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE taste_fingerprints ADD COLUMN cross_category_patterns JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE taste_fingerprints ADD COLUMN rating_distribution JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE taste_fingerprints ADD COLUMN previous_fingerprints JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
