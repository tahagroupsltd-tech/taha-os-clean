const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:QAZqaz%401725.@db.zmhmxfndzrrdmvvqblkx.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('invoices','projects','events','tasks')
    ORDER BY table_name, ordinal_position
  `))
  .then(r => {
    let tbl = '';
    r.rows.forEach(row => {
      if (row.table_name !== tbl) { tbl = row.table_name; console.log('\n=== ' + tbl + ' ==='); }
      console.log(' ', row.column_name, '(' + row.data_type + ')');
    });
    client.end();
  })
  .catch(e => { console.error(e.message); client.end(); process.exit(1); });
