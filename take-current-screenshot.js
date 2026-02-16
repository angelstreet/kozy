#!/usr/bin/env node
import puppeteer from 'puppeteer';

async function takeScreenshot() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  try {
    console.log('📸 Taking screenshot...');
    await page.goto('http://localhost:3004/kozy/', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/CURRENT-CALENDAR.png', fullPage: false });
    console.log('✅ Screenshot saved: CURRENT-CALENDAR.png');
    await browser.close();
  } catch (error) {
    console.error('❌ Failed:', error.message);
    await browser.close();
    throw error;
  }
}

takeScreenshot();
