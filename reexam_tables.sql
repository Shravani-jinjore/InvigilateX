-- ============================================================
-- Re-Exam Module — New Tables
-- Run this in: Supabase → SQL Editor → New Query
-- ============================================================

-- Re-exam exam slots (uploaded via CSV)
CREATE TABLE IF NOT EXISTS public.reexam_exams (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date                   DATE NOT NULL,
  time                   TEXT NOT NULL,
  subject_name           TEXT NOT NULL,
  course_code            TEXT NOT NULL,
  subject_faculty_name   TEXT,
  subject_faculty_mobile TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Admin sets how many faculty are needed per day
CREATE TABLE IF NOT EXISTS public.reexam_daily_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date        DATE NOT NULL UNIQUE,
  num_faculty INTEGER NOT NULL DEFAULT 20,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Re-exam allocations (separate from regular allocations)
CREATE TABLE IF NOT EXISTS public.reexam_allocations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id      UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  exam_id         UUID NOT NULL REFERENCES public.reexam_exams(id) ON DELETE CASCADE,
  is_own_subject  BOOLEAN NOT NULL DEFAULT false,
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (faculty_id, exam_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reexam_alloc_faculty ON public.reexam_allocations (faculty_id);
CREATE INDEX IF NOT EXISTS idx_reexam_alloc_exam    ON public.reexam_allocations (exam_id);
CREATE INDEX IF NOT EXISTS idx_reexam_exams_date    ON public.reexam_exams (date);

-- RLS
ALTER TABLE public.reexam_exams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reexam_daily_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reexam_allocations    ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "reexam_exams_admin_all"      ON public.reexam_exams;
DROP POLICY IF EXISTS "reexam_exams_auth_select"    ON public.reexam_exams;
CREATE POLICY "reexam_exams_admin_all"   ON public.reexam_exams   FOR ALL    USING (public.is_admin());
CREATE POLICY "reexam_exams_auth_select" ON public.reexam_exams   FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "reexam_settings_admin_all"   ON public.reexam_daily_settings;
DROP POLICY IF EXISTS "reexam_settings_auth_select" ON public.reexam_daily_settings;
CREATE POLICY "reexam_settings_admin_all"   ON public.reexam_daily_settings FOR ALL    USING (public.is_admin());
CREATE POLICY "reexam_settings_auth_select" ON public.reexam_daily_settings FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "reexam_alloc_admin_all"   ON public.reexam_allocations;
DROP POLICY IF EXISTS "reexam_alloc_own_select"  ON public.reexam_allocations;
CREATE POLICY "reexam_alloc_admin_all"  ON public.reexam_allocations FOR ALL    USING (public.is_admin());
CREATE POLICY "reexam_alloc_own_select" ON public.reexam_allocations FOR SELECT USING (
  faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid())
);

-- ============================================================
-- MIGRATION: Drop UNIQUE constraint on course_code
-- Run this in Supabase → SQL Editor if the table already exists
-- (The UNIQUE constraint prevents same course on multiple dates)
-- ============================================================
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.reexam_exams'::regclass
    AND contype = 'u'
    AND conname LIKE '%course_code%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.reexam_exams DROP CONSTRAINT ' || quote_ident(constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'No UNIQUE constraint on course_code found — nothing to drop.';
  END IF;
END $$;
