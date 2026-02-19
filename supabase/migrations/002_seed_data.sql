-- ============================================
-- UNTH School of Nursing - Quiz Database
-- Supabase Migration: 002_seed_data
-- ============================================
-- Optional: Run this to insert test data
-- ============================================

-- Insert some test candidates
INSERT INTO candidates (full_name, student_id, email) VALUES
  ('Jane Namulondo', 'NSG/2024/001', 'jane@student.ac.ug'),
  ('Peter Okello', 'NSG/2024/002', 'peter@student.ac.ug'),
  ('Grace Achieng', 'NSG/2024/003', 'grace@student.ac.ug')
ON CONFLICT (student_id) DO NOTHING;

-- Insert test attempts (linked to candidates above)
-- You would normally do this through the app flow, this is just for testing
DO $$
DECLARE
  jane_id UUID;
  peter_id UUID;
  grace_id UUID;
BEGIN
  SELECT id INTO jane_id FROM candidates WHERE student_id = 'NSG/2024/001';
  SELECT id INTO peter_id FROM candidates WHERE student_id = 'NSG/2024/002';
  SELECT id INTO grace_id FROM candidates WHERE student_id = 'NSG/2024/003';

  -- Jane: scored 85%
  INSERT INTO attempts (candidate_id, total_questions, correct_answers, score, percentage, time_taken, tab_switches, is_passed, started_at, answers)
  VALUES (jane_id, 20, 17, 17, 85, 1200, 0, TRUE, now() - interval '25 minutes', '{"1":"B","2":"C","3":"B","4":"A","5":"C","6":"D","7":"A","8":"B","9":"C","10":"A","11":"B","12":"A","13":"C","14":"D","15":"B","16":"A","17":"C","18":"D","19":"A","20":"B"}'::jsonb);

  -- Peter: scored 60%, some tab switches
  INSERT INTO attempts (candidate_id, total_questions, correct_answers, score, percentage, time_taken, tab_switches, is_passed, started_at, answers)
  VALUES (peter_id, 20, 12, 12, 60, 1500, 2, TRUE, now() - interval '30 minutes', '{"1":"B","2":"A","3":"B","4":"C","5":"C","6":"D","7":"B","8":"B","9":"A","10":"A","11":"C","12":"A","13":"C","14":"D","15":"A","16":"A","17":"C","18":"B","19":"A","20":"D"}'::jsonb);

  -- Grace: scored 40%, many cheating events
  INSERT INTO attempts (candidate_id, total_questions, correct_answers, score, percentage, time_taken, tab_switches, is_passed, started_at, answers)
  VALUES (grace_id, 20, 8, 8, 40, 900, 4, FALSE, now() - interval '20 minutes', '{"1":"A","2":"C","3":"D","4":"A","5":"B","6":"D","7":"A","8":"C","9":"C","10":"B","11":"B","12":"D","13":"A","14":"D","15":"B","16":"C","17":"A","18":"D","19":"B","20":"B"}'::jsonb);

  -- Add cheating events for Peter
  INSERT INTO cheating_events (attempt_id, candidate_id, event_type, details, occurred_at)
  SELECT a.id, peter_id, 'tab_switch', 'Switched away from quiz tab', now() - interval '15 minutes'
  FROM attempts a WHERE a.candidate_id = peter_id LIMIT 1;

  INSERT INTO cheating_events (attempt_id, candidate_id, event_type, details, occurred_at)
  SELECT a.id, peter_id, 'tab_switch', 'Switched away from quiz tab', now() - interval '10 minutes'
  FROM attempts a WHERE a.candidate_id = peter_id LIMIT 1;

  -- Add cheating events for Grace
  INSERT INTO cheating_events (attempt_id, candidate_id, event_type, details, occurred_at)
  SELECT a.id, grace_id, 'tab_switch', 'Switched away from quiz tab', now() - interval '18 minutes'
  FROM attempts a WHERE a.candidate_id = grace_id LIMIT 1;

  INSERT INTO cheating_events (attempt_id, candidate_id, event_type, details, occurred_at)
  SELECT a.id, grace_id, 'copy_attempt', 'Attempted to copy question content', now() - interval '16 minutes'
  FROM attempts a WHERE a.candidate_id = grace_id LIMIT 1;

  INSERT INTO cheating_events (attempt_id, candidate_id, event_type, details, occurred_at)
  SELECT a.id, grace_id, 'right_click', 'Attempted to open context menu', now() - interval '14 minutes'
  FROM attempts a WHERE a.candidate_id = grace_id LIMIT 1;

  INSERT INTO cheating_events (attempt_id, candidate_id, event_type, details, occurred_at)
  SELECT a.id, grace_id, 'devtools_attempt', 'Attempted to open DevTools (Ctrl+Shift+I)', now() - interval '12 minutes'
  FROM attempts a WHERE a.candidate_id = grace_id LIMIT 1;

  INSERT INTO cheating_events (attempt_id, candidate_id, event_type, details, occurred_at)
  SELECT a.id, grace_id, 'auto_submit_cheat', 'Quiz auto-submitted: exceeded maximum tab switches', now() - interval '10 minutes'
  FROM attempts a WHERE a.candidate_id = grace_id LIMIT 1;
END $$;
