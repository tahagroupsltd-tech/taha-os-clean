-- ============================================================
-- Taha Media OS — Add lead enrichment columns to crm_leads
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard → zmhmxfndzrrdmvvqblkx → SQL Editor
-- ============================================================

ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS niche         TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS phone         TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS youtube_url   TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS facebook_url  TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS website_url   TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS other_links   TEXT;

-- Verify:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'crm_leads' ORDER BY ordinal_position;
