// scratch/test-db.js
const { sbSelect } = require('../src/lib/supa.ts');

async function test() {
  console.log('Fetching users...');
  try {
    const res = await fetch('https://zmhmxfndzrrdmvvqblkx.supabase.co/rest/v1/users?select=id,name,role,username', {
      headers: {
        'Content-Type': 'application/json',
        apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaG14Zm5kenJyZG12dnFibGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDMzMzksImV4cCI6MjA5MjY3OTMzOX0.1i4olAULwrRO7wAP1Hpwur9Jl0SxieAn7dP5BaeyY9E',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaG14Zm5kenJyZG12dnFibGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDMzMzksImV4cCI6MjA5MjY3OTMzOX0.1i4olAULwrRO7wAP1Hpwur9Jl0SxieAn7dP5BaeyY9E',
      }
    });
    if (!res.ok) {
      console.error('Fetch failed:', res.status, await res.text());
      return;
    }
    const json = await res.json();
    console.log('Users in DB:', json);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
