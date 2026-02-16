#!/usr/bin/env node
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeScreenshot() {
  console.log('📸 Taking timeline screenshot for Task #707...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  try {
    // Navigate to Kozy login
    console.log('🌐 Navigating to Kozy...');
    await page.goto('http://localhost:3002/kozy/', { waitUntil: 'networkidle0', timeout: 15000 });

    // Login as owner
    console.log('🔐 Logging in as owner...');
    await page.type('input[type="email"]', 'owner@example.com');
    await page.type('input[type="password"]', 'user');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/calendar', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Switch to Timeline view
    console.log('📊 Switching to Timeline view...');
    await page.waitForSelector('button:has-text("Timeline")', { timeout: 5000 });
    await page.click('button:has-text("Timeline")');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for render

    // Scroll if needed
    await page.evaluate(() => window.scrollTo(0, 0));

    // Take screenshot
    const screenshotPath = path.join(__dirname, 'TASK-707-TIMELINE-FIXED.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Timeline screenshot saved: ${screenshotPath}`);

    await browser.close();
    return screenshotPath;
  } catch (error) {
    console.error('❌ Screenshot failed:', error.message);
    await browser.close();
    throw error;
  }
}

takeScreenshot()
  .then(path => {
    console.log('\\n✅ Timeline screenshot complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\\n❌ Failed to take screenshot:', error.message);
    process.exit(1);
  });
