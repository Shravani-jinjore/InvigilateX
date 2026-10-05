-- ============================================================
-- AI-Based Invigilation Duty Allocation System
-- Supabase PostgreSQL Schema  ▸  FIXED VERSION
-- Run this entire file in: Supabase → SQL Editor → New Query
-- ============================================================

-- Step 1: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Step 2: CORE TABLES (in dependency order)
-- ============================================================

-- 2a. users  (mirrors Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'faculty')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2b. faculty
CREATE TABLE IF NOT EXISTS public.faculty (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  department      TEXT NOT NULL,
  designation     TEXT NOT NULL,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('type1','type2','type3','type4','type5','type6')),
  max_duty        INTEGER NOT NULL DEFAULT 10,
  duty_count      INTEGER NOT NULL DEFAULT 0,
  email           TEXT,
  phone           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name)
);

-- 2c. subjects taught by each faculty member
CREATE TABLE IF NOT EXISTS public.subjects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id   UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  course_code  TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2d. availability  (faculty marks available / unavailable dates)
CREATE TABLE IF NOT EXISTS public.availability (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('available', 'unavailable')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (faculty_id, date)
);

-- 2e. exams
CREATE TABLE IF NOT EXISTS public.exams (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date                   DATE NOT NULL,
  session                TEXT NOT NULL CHECK (session IN ('FN', 'AN')),
  subject_name           TEXT NOT NULL,
  course_code            TEXT NOT NULL,
  rooms_required         INTEGER NOT NULL DEFAULT 1,
  subject_faculty_name   TEXT,
  subject_faculty_mobile TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (course_code)
);

-- 2f. allocations  (created AFTER faculty + exams so FKs resolve)
CREATE TABLE IF NOT EXISTS public.allocations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id  UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  exam_id     UUID NOT NULL REFERENCES public.exams(id)   ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint separately (safer across SQL clients)
ALTER TABLE public.allocations
  DROP CONSTRAINT IF EXISTS allocations_faculty_exam_unique;
ALTER TABLE public.allocations
  ADD  CONSTRAINT allocations_faculty_exam_unique UNIQUE (faculty_id, exam_id);

-- 2g. employment type priority weights
CREATE TABLE IF NOT EXISTS public.employment_type_weights (
  employment_type TEXT PRIMARY KEY CHECK (employment_type IN ('type1','type2','type3','type4','type5','type6')),
  weight_value    INTEGER NOT NULL,
  label           TEXT NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.employment_type_weights (employment_type, weight_value, label) VALUES
  ('type1', 1, 'Professor'),
  ('type2', 2, 'Associate Professor'),
  ('type3', 3, 'Assistant Professor (Senior Grade)'),
  ('type4', 4, 'Assistant Professor'),
  ('type5', 5, 'Lecturer'),
  ('type6', 6, 'Guest Faculty')
ON CONFLICT (employment_type) DO NOTHING;

-- ============================================================
-- Step 3: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_availability_faculty_date ON public.availability (faculty_id, date);
CREATE INDEX IF NOT EXISTS idx_allocations_faculty       ON public.allocations   (faculty_id);
CREATE INDEX IF NOT EXISTS idx_allocations_exam          ON public.allocations   (exam_id);
CREATE INDEX IF NOT EXISTS idx_subjects_faculty          ON public.subjects      (faculty_id);
CREATE INDEX IF NOT EXISTS idx_exams_date                ON public.exams         (date);
CREATE INDEX IF NOT EXISTS idx_faculty_type              ON public.faculty       (employment_type);

-- ============================================================
-- Step 4: ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_type_weights ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 5: RLS POLICIES  (drop-then-create so script is re-runnable)
-- ============================================================

-- Security Definer function to avoid RLS recursion on users table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS '
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = ''admin''
  );
' LANGUAGE sql SECURITY DEFINER;

-- users
DROP POLICY IF EXISTS "users_read_all" ON public.users;
DROP POLICY IF EXISTS "users_self_update" ON public.users;
DROP POLICY IF EXISTS "users_admin_all" ON public.users;

CREATE POLICY "users_read_all" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "users_self_update" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_admin_all" ON public.users FOR ALL USING (public.is_admin());

-- faculty
DROP POLICY IF EXISTS "faculty_admin_all"    ON public.faculty;
DROP POLICY IF EXISTS "faculty_self_select"  ON public.faculty;
CREATE POLICY "faculty_admin_all"   ON public.faculty FOR ALL    USING (public.is_admin());
CREATE POLICY "faculty_self_select" ON public.faculty FOR SELECT USING (user_id = auth.uid());

-- subjects
DROP POLICY IF EXISTS "subjects_admin_all"   ON public.subjects;
DROP POLICY IF EXISTS "subjects_own_all"     ON public.subjects;
CREATE POLICY "subjects_admin_all" ON public.subjects FOR ALL USING (public.is_admin());
CREATE POLICY "subjects_own_all" ON public.subjects FOR ALL USING (
  faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid())
);

-- availability
DROP POLICY IF EXISTS "avail_admin_all"  ON public.availability;
DROP POLICY IF EXISTS "avail_own_all"    ON public.availability;
CREATE POLICY "avail_admin_all" ON public.availability FOR ALL USING (public.is_admin());
CREATE POLICY "avail_own_all" ON public.availability FOR ALL USING (
  faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid())
);

-- exams
DROP POLICY IF EXISTS "exams_admin_all"      ON public.exams;
DROP POLICY IF EXISTS "exams_auth_select"    ON public.exams;
CREATE POLICY "exams_admin_all"   ON public.exams FOR ALL    USING (public.is_admin());
CREATE POLICY "exams_auth_select" ON public.exams FOR SELECT USING (auth.role() = 'authenticated');

-- allocations
DROP POLICY IF EXISTS "alloc_admin_all"     ON public.allocations;
DROP POLICY IF EXISTS "alloc_own_select"    ON public.allocations;
CREATE POLICY "alloc_admin_all"  ON public.allocations FOR ALL USING (public.is_admin());
CREATE POLICY "alloc_own_select" ON public.allocations FOR SELECT USING (
  faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid())
);

-- employment_type_weights
DROP POLICY IF EXISTS "weights_auth_select"  ON public.employment_type_weights;
DROP POLICY IF EXISTS "weights_admin_all"    ON public.employment_type_weights;
CREATE POLICY "weights_auth_select" ON public.employment_type_weights FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "weights_admin_all"   ON public.employment_type_weights FOR ALL    USING (public.is_admin());

-- ============================================================
-- Step 6: TRIGGER — auto-update faculty.updated_at
-- Uses simple plpgsql with single-quoted body (no dollar-quoting)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS 'BEGIN NEW.updated_at = NOW(); RETURN NEW; END;';

DROP TRIGGER IF EXISTS trg_faculty_updated_at ON public.faculty;
CREATE TRIGGER trg_faculty_updated_at
  BEFORE UPDATE ON public.faculty
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Step 7: HELPER FUNCTION — reset all duty counts to 0
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_duty_counts()
  RETURNS void
  LANGUAGE plpgsql
AS 'BEGIN UPDATE public.faculty SET duty_count = 0; END;';

-- ============================================================
-- Step 8: REPORT VIEW
-- ============================================================
DROP VIEW IF EXISTS public.allocation_report;
CREATE VIEW public.allocation_report AS
SELECT
  a.id            AS allocation_id,
  f.name          AS faculty_name,
  f.department,
  f.designation,
  f.employment_type,
  f.duty_count,
  e.date          AS exam_date,
  e.session,
  e.subject_name,
  e.course_code,
  e.rooms_required,
  e.subject_faculty_name,
  e.subject_faculty_mobile,
  a.assigned_at
FROM  public.allocations a
JOIN  public.faculty      f ON a.faculty_id = f.id
JOIN  public.exams        e ON a.exam_id    = e.id
ORDER BY e.date, e.session, f.name;

-- ============================================================
-- Done! After running this script:
--
--  1. Go to Supabase → Authentication → Users
--  2. Create your admin user (email + password)
--  3. Copy the generated UUID, then run:
--
--     INSERT INTO public.users (id, email, role)
--     VALUES ('<paste-uuid-here>', 'admin@example.com', 'admin');
--
-- ============================================================
