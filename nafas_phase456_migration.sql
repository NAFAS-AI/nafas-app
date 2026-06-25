-- ============================================================
-- NAFAS Learning System — Phase 4/5/6 Migration
-- © 2026 NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
-- Phase 4: Deep Conversation Memory
-- Phase 5: Self-Learning Engine  
-- Phase 6: Autonomous Decision Making
-- ============================================================

-- ── Phase 4: Conversation Log ──
CREATE TABLE IF NOT EXISTS nafas_conversation_log (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'model')),
  message_text TEXT NOT NULL,
  detected_emotion TEXT,
  detected_topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_convo_visitor ON nafas_conversation_log(visitor_id);
CREATE INDEX IF NOT EXISTS idx_convo_session ON nafas_conversation_log(session_id);

-- ── Phase 4: Session Summaries ──
CREATE TABLE IF NOT EXISTS nafas_session_summaries (
  id SERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  summary_text TEXT NOT NULL,
  key_topics TEXT[] DEFAULT '{}',
  emotional_arc TEXT,
  techniques_used TEXT[] DEFAULT '{}',
  key_moments TEXT[] DEFAULT '{}',
  outcome TEXT DEFAULT 'unknown' CHECK (outcome IN ('improved', 'neutral', 'worsened', 'crisis', 'unknown')),
  follow_up_suggestions TEXT[] DEFAULT '{}',
  message_count INT DEFAULT 0,
  mood_rating INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_summary_visitor ON nafas_session_summaries(visitor_id);

-- ── Phase 5: Learned Vocabulary ──
CREATE TABLE IF NOT EXISTS nafas_learned_vocabulary (
  id SERIAL PRIMARY KEY,
  word TEXT NOT NULL,
  meaning TEXT,
  dialect TEXT DEFAULT 'unknown',
  category TEXT DEFAULT 'expression',
  example_context TEXT,
  frequency INT DEFAULT 1,
  confidence FLOAT DEFAULT 0.5,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(word, dialect)
);

-- ── Phase 5: Technique Effectiveness ──
CREATE TABLE IF NOT EXISTS nafas_technique_effectiveness (
  id SERIAL PRIMARY KEY,
  technique TEXT NOT NULL,
  topic TEXT NOT NULL,
  gender TEXT DEFAULT 'all',
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  effectiveness_score FLOAT DEFAULT 0.5,
  avg_mood_after FLOAT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(technique, topic, gender)
);

-- ── Phase 5: Collective Insights ──
CREATE TABLE IF NOT EXISTS nafas_collective_insights (
  id SERIAL PRIMARY KEY,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  supporting_data JSONB DEFAULT '{}',
  confidence FLOAT DEFAULT 0.5,
  times_confirmed INT DEFAULT 1,
  first_discovered TIMESTAMPTZ DEFAULT NOW(),
  last_confirmed TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- ── Phase 6: Self-Knowledge ──
CREATE TABLE IF NOT EXISTS nafas_self_knowledge (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  insight TEXT NOT NULL,
  evidence TEXT,
  applies_to TEXT DEFAULT 'all',
  confidence FLOAT DEFAULT 0.5,
  times_validated INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- ── Enable RLS on all tables ──
ALTER TABLE nafas_conversation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE nafas_session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE nafas_learned_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE nafas_technique_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE nafas_collective_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE nafas_self_knowledge ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_convo_log_insert') THEN
    CREATE POLICY anon_convo_log_insert ON nafas_conversation_log FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_convo_log_select') THEN
    CREATE POLICY anon_convo_log_select ON nafas_conversation_log FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_summary_insert') THEN
    CREATE POLICY anon_summary_insert ON nafas_session_summaries FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_summary_select') THEN
    CREATE POLICY anon_summary_select ON nafas_session_summaries FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_vocab_all') THEN
    CREATE POLICY anon_vocab_all ON nafas_learned_vocabulary FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_technique_all') THEN
    CREATE POLICY anon_technique_all ON nafas_technique_effectiveness FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_collective_all') THEN
    CREATE POLICY anon_collective_all ON nafas_collective_insights FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_selfknow_all') THEN
    CREATE POLICY anon_selfknow_all ON nafas_self_knowledge FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Seed initial technique effectiveness data ──
INSERT INTO nafas_technique_effectiveness (technique, topic, gender, success_count, total_count, effectiveness_score) VALUES
  ('breathing', 'anxiety', 'all', 5, 6, 0.83),
  ('breathing', 'work', 'all', 4, 6, 0.67),
  ('breathing', 'sleep', 'all', 4, 5, 0.80),
  ('empathy', 'loneliness', 'all', 6, 7, 0.86),
  ('empathy', 'family', 'all', 5, 6, 0.83),
  ('empathy', 'relationship', 'all', 5, 7, 0.71),
  ('reframe', 'work', 'all', 5, 7, 0.71),
  ('reframe', 'study', 'all', 4, 5, 0.80),
  ('socratic', 'burnout', 'all', 4, 5, 0.80),
  ('socratic', 'general', 'all', 3, 5, 0.60),
  ('strength_finding', 'loneliness', 'all', 4, 5, 0.80),
  ('strength_finding', 'burnout', 'all', 3, 5, 0.60),
  ('grounding', 'anxiety', 'all', 5, 6, 0.83),
  ('visualization', 'sleep', 'all', 4, 5, 0.80),
  ('journaling', 'general', 'all', 3, 5, 0.60)
ON CONFLICT (technique, topic, gender) DO NOTHING;

-- ── Seed initial self-knowledge ──
INSERT INTO nafas_self_knowledge (category, insight, evidence, applies_to, confidence) VALUES
  ('style_rule', 'استخدام لهجة إماراتية/خليجية يزيد راحة المستخدم وثقته', 'ردود الفعل الإيجابية عند استخدام كلمات مثل شحالك وتبي', 'all', 0.9),
  ('style_rule', 'الردود القصيرة (2-4 جمل) أفضل من الردود الطويلة', 'المستخدمون يتفاعلون أكثر مع الردود المختصرة', 'all', 0.85),
  ('cultural_note', 'التعابير الدينية عند الخليجيين تعبير عن مشاعر عميقة وليست مجرد كلمات', 'يارب ارتاح غالباً = إرهاق شديد', 'all', 0.9),
  ('effective_approach', 'اقتباس كلمات المستخدم بالضبط يزيد الثقة والتواصل', 'لما قلت X = انعكاس فعّال', 'all', 0.85),
  ('effective_approach', 'مع الإناث استخدام شين المخاطبة (شحالش) يزيد الحميمية', 'ردود إيجابية عند التحول للشين', 'female', 0.8),
  ('vocabulary_rule', 'كلمة مطفوق تعني غاضب جداً في اللهجة الخليجية', 'سياق الاستخدام في محادثات عن الغضب', 'all', 0.9),
  ('vocabulary_rule', 'كلمة يحز بخاطري تعني يزعلني بعمق في الإماراتية', 'استخدام متكرر في سياق العائلة', 'all', 0.9),
  ('mistake_learned', 'لا أبداً أسأل عن معنى كلمة عربية مهما كانت اللهجة', 'ردود فعل سلبية عند السؤال عن كلمات معروفة', 'all', 0.95)
ON CONFLICT DO NOTHING;
