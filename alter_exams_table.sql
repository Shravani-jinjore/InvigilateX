-- ============================================================
-- Run this in Supabase SQL Editor to add the 2 new columns
-- to the exams table (subject faculty name + mobile)
-- ============================================================

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS subject_faculty_name   TEXT,
  ADD COLUMN IF NOT EXISTS subject_faculty_mobile TEXT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'exams'
ORDER BY ordinal_position;
