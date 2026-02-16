const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Login
  await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.type('input[type="email"]', 'user');
  await page.type('input[type="password"]', 'user');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 5000 });

  // Desktop screenshot - Timeline view
  await page.setViewport({ width: 1400, height: 1200 });
  await page.click('div.flex.rounded-lg.border button:nth-child(3)');
  await page.waitForSelector('.overflow-x-auto', { timeout: 3000 });
  await page.waitForTimeout(1500); // Allow animations
  await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-DESKTOP.png', fullPage: true });
  console.log('✅ Desktop screenshot saved');

  // Mobile screenshot - Timeline view (scrolled)
  await page.setViewport({ width: 375, height: 667 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1');
  await page.click('div.flex.rounded-lg.border button:nth-child(3)');
  await page.waitForSelector('.overflow-x-auto');
  await page.waitForTimeout(1500);
  // Scroll to show timeline content
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-MOBILE.png', fullPage: true });
  console.log('✅ Mobile screenshot saved');

  await browser.close();
})();
