-- ============================================================
-- Taha Media OS — Add SOP & Kanban columns to projects table
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard → zmhmxfndzrrdmvvqblkx → SQL Editor
-- ============================================================

-- 1. Add sopLevel column (nullable integer 1–7, maps to SOP pipeline)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS "sopLevel" INTEGER;

-- 2. Add boardColumn if it doesn't exist yet (kanban stage)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS "boardColumn" TEXT DEFAULT 'ACTIVE';

-- 3. Add value column (project monetary value in INR)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS "value" DECIMAL(12, 2);

-- ✅ Verify columns were added:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
