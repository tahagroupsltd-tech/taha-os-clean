const { sbSelect } = require('../src/lib/supa.ts');

async function debug() {
  console.log('--- Fetching all loans from database ---');
  try {
    const loans = await sbSelect('loans', {});
    console.log(`Found ${loans.length} loans.`);
    for (const l of loans) {
      console.log(`Loan ID: ${l.id} | Title: "${l.title}" | Amount: ${l.amount} | Status: "${l.status}"`);
    }
  } catch (err) {
    console.error('Error fetching loans:', err);
  }
}

debug();
