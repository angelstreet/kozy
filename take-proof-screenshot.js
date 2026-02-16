#!/usr/bin/env node
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeScreenshot() {
  console.log('📸 Taking proof screenshot for Task #702...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  try {
    // Navigate to Kozy frontend (owner dashboard)
    console.log('🌐 Navigating to Kozy frontend...');
    await page.goto('http://localhost:3002/kozy/', { waitUntil: 'networkidle0', timeout: 10000 });

    // Wait a bit for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot
    const screenshotPath = path.join(__dirname, 'TASK-702-PROOF.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Screenshot saved: ${screenshotPath}`);

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
    console.log('\n✅ Proof screenshot complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed to take screenshot:', error.message);
    process.exit(1);
  });
