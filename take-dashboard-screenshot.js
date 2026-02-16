#!/usr/bin/env node
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeScreenshot() {
  console.log('📸 Taking dashboard screenshot for Task #702...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  try {
    // Navigate to Kozy login
    console.log('🌐 Navigating to Kozy login...');
    await page.goto('http://localhost:3002/kozy/', { waitUntil: 'networkidle0', timeout: 10000 });

    // Login with test account
    console.log('🔐 Logging in with owner@example.com/user...');
    await page.type('input[type="email"]', 'owner@example.com');
    await page.type('input[type="password"]', 'user');
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📊 Waiting for dashboard...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot
    const screenshotPath = path.join(__dirname, 'TASK-702-DASHBOARD.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Dashboard screenshot saved: ${screenshotPath}`);

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
    console.log('\n✅ Dashboard screenshot complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed to take screenshot:', error.message);
    process.exit(1);
  });
