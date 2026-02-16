const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security'] 
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()));

  try {
    // Direct to calendar, see if logged in
    console.log('1. Direct to calendar...');
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-direct.png', fullPage: true });
    const title = await page.title();
    console.log('Title:', title);
    const url = page.url();
    console.log('URL after goto:', url);

    if (url.includes('sign-in') || url.includes('login')) {
      console.log('2. Need login...');
      await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[name="email"] || input[type="email"]', { timeout: 10000 });
      await page.type('input[name="email"], input[type="email"]', 'user@example.com');
      await page.type('input[name="password"], input[type="password"]', 'user');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'networkidle', timeout: 30000 });
    }

    // Wait for calendar content
    await page.waitForSelector('h1, .calendar, [class*="calendar"]', { timeout: 10000 });
    await page.setViewport({ width: 1440, height: 900 });
    await page.waitForTimeout(2000);

    // Look for timeline button and click if present
    const buttons = await page.$$eval('div.flex.rounded-lg.border button', buttons => buttons.map(b => b.textContent.trim()));
    console.log('View buttons:', buttons);
    const timelineIdx = buttons.findIndex(b => b.toLowerCase().includes('timeline') || b.toLowerCase().includes('ligne'));
    if (timelineIdx > -1) {
      const timelineBtn = await page.$('div.flex.rounded-lg.border button');
      await timelineBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check for Dieudonne
    const textContent = await page.evaluate(() => document.body.innerText);
    const hasDieudonne = textContent.toLowerCase().includes('dieudonne');
    console.log('Has Dieudonne?', hasDieudonne);
    const febDates = textContent.match(/15.*16|16.*15|feb\s*15|feb\s*16|15\s*févr|16\s*févr/gi);
    console.log('Feb dates found:', febDates);

    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true });
    console.log('✅ FINAL Screenshot saved!');
  } catch (e) {
    console.error('ERROR:', e.message);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-ERROR.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
