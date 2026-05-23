// scratch/test-fetch-overview.js
const http = require('http');

function login() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ identifier: 'admin', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'];
        console.log('Login response cookies raw:', cookies);
        if (res.statusCode === 200 && cookies) {
          resolve(cookies);
        } else {
          reject(new Error(`Login failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function fetchOverview(cookies, path = '/overview') {
  return new Promise((resolve, reject) => {
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
    console.log(`Sending Cookie header for GET ${path}:`, cookieHeader);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Cookie': cookieHeader
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('Logging in as admin...');
    const cookies = await login();
    console.log('Login successful. Cookies received.');
    
    console.log('Fetching /overview...');
    let result = await fetchOverview(cookies);
    console.log('Fetch /overview status code:', result.statusCode);
    
    if (result.statusCode === 307 || result.statusCode === 302) {
      const location = result.headers.location;
      console.log(`Redirected to: ${location}`);
      const newPath = new URL(location, 'http://localhost:3000').pathname;
      if (newPath === '/login') {
        console.log('Login redirect detected, showing login page check.');
      }
      result = await fetchOverview(cookies, newPath);
      console.log(`Fetch redirected path ${newPath} status code:`, result.statusCode);
    }

    if (result.body.includes('Unexpected error')) {
      console.log('WARNING: The page contains "Unexpected error" text!');
      const match = result.body.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
      if (match) {
        console.log('Error details from page:', match[1]);
      }
    } else {
      console.log('Page loaded successfully! No "Unexpected error" text found in HTML.');
    }
  } catch (err) {
    console.error('Error during execution:', err);
  }
}

main();
