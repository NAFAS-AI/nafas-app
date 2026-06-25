-- ============================================================
-- NAFAS Memory System — Supabase Migration
-- © 2026 NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
-- Run this in Supabase SQL Editor ONCE
-- ============================================================

CREATE TABLE IF NOT EXISTS nafas_user_profiles (
  visitor_id    TEXT PRIMARY KEY,
  display_name  TEXT DEFAULT '',
  gender        TEXT DEFAULT 'unknown',
  dialect       TEXT DEFAULT 'khaleeji',
  age_group     TEXT DEFAULT 'unknown',
  corrections   JSONB DEFAULT '[]'::jsonb,
  topics        JSONB DEFAULT '[]'::jsonb,
  preferences   JSONB DEFAULT '{}'::jsonb,
  session_count INTEGER DEFAULT 0,
  last_mood     TEXT DEFAULT '',
  personality_notes TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nafas_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_profiles" ON nafas_user_profiles
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_profiles" ON nafas_user_profiles
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_profiles" ON nafas_user_profiles
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_nafas_profiles_vid
  ON nafas_user_profiles(visitor_id);
