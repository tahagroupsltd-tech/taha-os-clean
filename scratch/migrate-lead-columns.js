const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:QAZqaz%401725.@db.zmhmxfndzrrdmvvqblkx.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS niche TEXT;
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS instagram_url TEXT;
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS youtube_url TEXT;
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS facebook_url TEXT;
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS website_url TEXT;
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS other_links TEXT;
`;

client.connect()
  .then(() => client.query(sql))
  .then(() => { console.log('Migration OK - all 7 columns added'); client.end(); })
  .catch(e => { console.error('Error:', e.message); client.end(); process.exit(1); });
