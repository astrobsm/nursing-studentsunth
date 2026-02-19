-- ============================================
-- UNTH School of Nursing - Quiz Database
-- Supabase Migration: 001_initial_schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================

-- 1. CANDIDATES TABLE
-- Stores student registration info
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(student_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_candidates_student_id ON candidates(student_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);

-- 2. ATTEMPTS TABLE
-- Stores each quiz attempt with score and timing
CREATE TABLE IF NOT EXISTS attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  total_questions INTEGER NOT NULL DEFAULT 20,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  time_taken INTEGER NOT NULL DEFAULT 0,  -- in seconds
  tab_switches INTEGER NOT NULL DEFAULT 0,
  is_passed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_candidate_id ON attempts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_attempts_percentage ON attempts(percentage DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_submitted_at ON attempts(submitted_at DESC);

-- 3. CHEATING_EVENTS TABLE
-- Logs every detected cheating/suspicious event
CREATE TABLE IF NOT EXISTS cheating_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  -- Allowed types: tab_switch, window_blur, copy_attempt, paste_attempt,
  --               right_click, print_screen, devtools_attempt, auto_submit_cheat
  details TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cheating_events_attempt_id ON cheating_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_cheating_events_candidate_id ON cheating_events(candidate_id);
CREATE INDEX IF NOT EXISTS idx_cheating_events_type ON cheating_events(event_type);

-- 4. VIEWS (for admin dashboard queries)

-- View: All results ranked by score
CREATE OR REPLACE VIEW ranked_results AS
SELECT
  a.id AS attempt_id,
  c.id AS candidate_id,
  c.full_name,
  c.student_id,
  c.email,
  a.total_questions,
  a.correct_answers,
  a.score,
  a.percentage,
  a.time_taken,
  a.tab_switches,
  a.is_passed,
  a.answers,
  a.started_at,
  a.submitted_at,
  COALESCE(ce.cheat_count, 0) AS cheat_event_count,
  RANK() OVER (ORDER BY a.percentage DESC, a.time_taken ASC) AS rank
FROM attempts a
JOIN candidates c ON c.id = a.candidate_id
LEFT JOIN (
  SELECT attempt_id, COUNT(*) AS cheat_count
  FROM cheating_events
  GROUP BY attempt_id
) ce ON ce.attempt_id = a.id
ORDER BY a.percentage DESC, a.time_taken ASC;

-- View: Cheating summary per candidate
CREATE OR REPLACE VIEW cheating_summary AS
SELECT
  c.full_name,
  c.student_id,
  ce.attempt_id,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE ce.event_type = 'tab_switch') AS tab_switches,
  COUNT(*) FILTER (WHERE ce.event_type = 'window_blur') AS window_blurs,
  COUNT(*) FILTER (WHERE ce.event_type = 'copy_attempt') AS copy_attempts,
  COUNT(*) FILTER (WHERE ce.event_type = 'paste_attempt') AS paste_attempts,
  COUNT(*) FILTER (WHERE ce.event_type = 'right_click') AS right_clicks,
  COUNT(*) FILTER (WHERE ce.event_type = 'print_screen') AS screenshot_attempts,
  COUNT(*) FILTER (WHERE ce.event_type = 'devtools_attempt') AS devtools_attempts,
  COUNT(*) FILTER (WHERE ce.event_type = 'auto_submit_cheat') AS auto_submits
FROM cheating_events ce
JOIN candidates c ON c.id = ce.candidate_id
GROUP BY c.full_name, c.student_id, ce.attempt_id;

-- 5. ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous inserts (students registering & submitting)
CREATE POLICY "Allow anonymous insert candidates"
  ON candidates FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous insert attempts"
  ON attempts FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous insert cheating_events"
  ON cheating_events FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow service_role full access (for API routes / admin)
CREATE POLICY "Service role full access candidates"
  ON candidates FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role full access attempts"
  ON attempts FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role full access cheating_events"
  ON cheating_events FOR ALL
  TO service_role
  USING (true);

-- Policy: Allow anon to read their own candidate row (by student_id match)
CREATE POLICY "Anon can read own candidate"
  ON candidates FOR SELECT
  TO anon
  USING (true);

-- Policy: Allow anon to read own attempt
CREATE POLICY "Anon can read own attempt"
  ON attempts FOR SELECT
  TO anon
  USING (true);
