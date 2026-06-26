-- ============================================================
-- NAFAS — nafas_dictionary table migration
-- Community-taught word dictionary for the Learned Dictionary system
-- © 2026 NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
-- ============================================================

CREATE TABLE IF NOT EXISTS nafas_dictionary (
  id          BIGSERIAL PRIMARY KEY,
  word        TEXT NOT NULL,
  meaning     TEXT DEFAULT '',
  taught_by_journey TEXT DEFAULT 'anonymous',
  times_seen  INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  -- Unique constraint: one entry per word (upsert will merge duplicates)
  CONSTRAINT nafas_dictionary_word_unique UNIQUE (word)
);

-- RLS: Enable Row Level Security
ALTER TABLE nafas_dictionary ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read the dictionary (community resource)
CREATE POLICY "nafas_dictionary_read" ON nafas_dictionary
  FOR SELECT USING (true);

-- Policy: Anon can insert new words  
CREATE POLICY "nafas_dictionary_insert" ON nafas_dictionary
  FOR INSERT WITH CHECK (true);

-- Policy: Anon can update (increment times_seen via upsert)
CREATE POLICY "nafas_dictionary_update" ON nafas_dictionary
  FOR UPDATE USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_nafas_dictionary_word ON nafas_dictionary (word);
CREATE INDEX IF NOT EXISTS idx_nafas_dictionary_times_seen ON nafas_dictionary (times_seen DESC);

-- Function to auto-update updated_at on changes
CREATE OR REPLACE FUNCTION nafas_dictionary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nafas_dictionary_updated_at_trigger
  BEFORE UPDATE ON nafas_dictionary
  FOR EACH ROW
  EXECUTE FUNCTION nafas_dictionary_updated_at();
