const { sbSelect } = require('../src/lib/supa.ts');

async function debug() {
  console.log('--- Fetching all transactions from database ---');
  try {
    const transactions = await sbSelect('transactions', {
      select: 'id,title,amount,type,category,date,projectId'
    });
    console.log(`Found ${transactions.length} transactions.`);
    for (const t of transactions) {
      console.log(`Tx ID: ${t.id} | Title: "${t.title}" | Amount: ${t.amount} | Type: "${t.type}" | Date: ${t.date}`);
    }
  } catch (err) {
    console.error('Error fetching transactions:', err);
  }
}

debug();
