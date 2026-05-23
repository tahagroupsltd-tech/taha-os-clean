// scratch/run-browser-debug.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Installing puppeteer locally to debug the browser console...');
  try {
    execSync('npm install --no-save puppeteer', { stdio: 'inherit' });
    console.log('Puppeteer installed successfully!');
  } catch (err) {
    console.error('Puppeteer installation failed:', err);
    return;
  }

  const puppeteer = require('puppeteer');
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Capture console errors
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning' || msg.text().includes('error')) {
      console.log(`[BROWSER CONSOLE ${type.toUpperCase()}]:`, msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('[BROWSER PAGE ERROR]:', err.toString());
  });

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    
    console.log('Logging in as admin...');
    await page.type('#username-or-phone', 'admin');
    await page.type('#password', 'admin123');
    
    // Click submit and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);

    console.log('Current URL after login:', page.url());
    
    // Wait a bit to capture any hydrated client-side errors
    console.log('Waiting 5 seconds for initial page hydration...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Opening Active Clients sidebar...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const activeClientsBtn = buttons.find(b => b.textContent && b.textContent.includes('Active Clients'));
      if (activeClientsBtn) {
        activeClientsBtn.click();
      } else {
        throw new Error('Active Clients button not found');
      }
    });
    
    console.log('Waiting 5 seconds for sidebar to fetch data and render...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const screenshotPath = 'C:\\Users\\SEC\\.gemini\/\/antigravity\\brain\\34e4085f-6c24-4a92-920b-3dd83bdadc7c\\overview_crash_screenshot.png';
    console.log('Taking screenshot...');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);
    
    const pageContent = await page.content();
    console.log('Page HTML title:', await page.title());
    if (pageContent.includes('Unexpected error') || pageContent.includes('Application error')) {
      console.log('Page content contains error text!');
    }
    
    console.log('Done capturing console logs.');
  } catch (err) {
    console.error('Error during browser testing:', err);
  } finally {
    await browser.close();
  }
}

main();
