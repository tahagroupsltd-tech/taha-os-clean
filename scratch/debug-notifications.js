const { sbSelect } = require('../src/lib/supa.ts');

async function debug() {
  console.log('--- Fetching all notifications from database ---');
  try {
    const notifications = await sbSelect('notifications', {
      select: 'id,userId,title,message,type,read,link,createdAt'
    });
    console.log(`Found ${notifications.length} notifications.`);
    for (const n of notifications) {
      console.log(`Notification ID: ${n.id} | UserID: ${n.userId} | Title: "${n.title}" | Read: ${n.read} | CreatedAt: ${n.createdAt}`);
    }
  } catch (err) {
    console.error('Error fetching notifications:', err);
  }
}

debug();
