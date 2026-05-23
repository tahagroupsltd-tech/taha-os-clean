const { sbSelect } = require('../src/lib/supa.ts');

async function debug() {
  console.log('--- Fetching all users from database ---');
  try {
    const users = await sbSelect('users', {
      select: 'id,username,name,role,isActive'
    });
    console.log(`Found ${users.length} users.`);
    for (const u of users) {
      console.log(`User ID: ${u.id} | Username: "${u.username}" | Name: "${u.name}" | Role: "${u.role}" | Active: ${u.isActive}`);
    }
  } catch (err) {
    console.error('Error fetching users:', err);
  }
}

debug();
