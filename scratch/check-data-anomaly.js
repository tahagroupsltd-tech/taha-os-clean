// scratch/check-data-anomaly.js
const { sbSelect } = require('../src/lib/supa.ts');

function formatDate(date) {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid Date object created from value: ${date}`);
    }
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (err) {
    throw new Error(`formatDate failed for "${date}": ${err.message}`);
  }
}

function formatTime(date) {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid Date object for formatTime: ${date}`);
    }
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (err) {
    throw new Error(`formatTime failed for "${date}": ${err.message}`);
  }
}

function formatMoney(amount) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

async function run() {
  console.log('--- Fetching all database records to detect rendering anomalies ---');

  // 1. Check notifications
  const notifications = await sbSelect('notifications', {});
  console.log(`Fetched ${notifications.length} notifications`);
  for (const n of notifications) {
    try {
      formatDate(n.createdAt);
    } catch (err) {
      console.error(`[Anomaly] Notification ID ${n.id} failed:`, err.message);
    }
  }

  // 2. Check tasks
  const tasks = await sbSelect('tasks', {});
  console.log(`Fetched ${tasks.length} tasks`);
  for (const t of tasks) {
    try {
      if (t.deadline) {
        formatDate(t.deadline);
      }
    } catch (err) {
      console.error(`[Anomaly] Task ID ${t.id} ("${t.title}") failed:`, err.message);
    }
  }

  // 3. Check content
  const content = await sbSelect('content', {});
  console.log(`Fetched ${content.length} content items`);
  for (const c of content) {
    try {
      if (c.postDate) {
        formatDate(c.postDate);
      }
    } catch (err) {
      console.error(`[Anomaly] Content ID ${c.id} ("${c.title}") failed:`, err.message);
    }
  }

  // 4. Check events
  const events = await sbSelect('events', {});
  console.log(`Fetched ${events.length} events`);
  for (const e of events) {
    try {
      formatDate(e.startTime);
      formatTime(e.startTime);
      formatDate(e.endTime);
      formatTime(e.endTime);
    } catch (err) {
      console.error(`[Anomaly] Event ID ${e.id} ("${e.title}") failed:`, err.message);
    }
  }

  // 5. Check metrics
  const metrics = await sbSelect('content_metrics', {});
  console.log(`Fetched ${metrics.length} metrics`);
  for (const m of metrics) {
    try {
      if (m.views === null || m.views === undefined) {
        console.error(`[Anomaly] ContentMetric ID ${m.id} has null/undefined views`);
      } else {
        m.views.toLocaleString();
      }
      if (m.likes === null || m.likes === undefined) {
        console.error(`[Anomaly] ContentMetric ID ${m.id} has null/undefined likes`);
      } else {
        m.likes.toLocaleString();
      }
      if (m.comments === null || m.comments === undefined) {
        console.error(`[Anomaly] ContentMetric ID ${m.id} has null/undefined comments`);
      } else {
        m.comments.toLocaleString();
      }
    } catch (err) {
      console.error(`[Anomaly] ContentMetric ID ${m.id} failed:`, err.message);
    }
  }

  console.log('--- Done checking data anomalies ---');
}

run();
