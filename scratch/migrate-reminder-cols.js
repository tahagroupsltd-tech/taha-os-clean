const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:QAZqaz%401725.@db.zmhmxfndzrrdmvvqblkx.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS promise_to_pay_date DATE;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMPTZ;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS reminder_note TEXT;
  `))
  .then(() => { console.log('Migration OK - promise_to_pay_date, reminder_date, reminder_note added to projects'); client.end(); })
  .catch(e => { console.error('Error:', e.message); client.end(); process.exit(1); });
