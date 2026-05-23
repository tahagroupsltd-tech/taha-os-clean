const { sbSelect } = require('../src/lib/supa.ts');

async function debug() {
  console.log('--- Fetching all metrics from database ---');
  try {
    const metrics = await sbSelect('content_metrics', {});
    console.log(`Found ${metrics.length} content_metrics.`);
    for (const m of metrics) {
      console.log(`Metric ID: ${m.id} | Content ID: ${m.content_id} | Views: ${m.views} | Likes: ${m.likes} | Comments: ${m.comments} | Shares: ${m.shares}`);
    }
  } catch (err) {
    console.error('Error fetching metrics:', err);
  }
}

debug();
