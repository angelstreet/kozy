const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Desktop screenshot
  await page.setViewport({ width: 1400, height: 1200 });
  await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'user');
  await page.fill('input[type="password"]', 'user');
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Connexion")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'networkidle' });
  await page.waitForSelector('.p-4 h1', { timeout: 5000 });
  await page.click('.flex.rounded-lg.border button:nth-child(3)'); // Timeline toggle
  await page.waitForSelector('.overflow-x-auto .grid', { timeout: 5000 });
  await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-DESKTOP.png', fullPage: true });
  console.log('Desktop screenshot saved');

  // Mobile screenshot
  await page.setViewport({ width: 375, height: 667 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('.flex.rounded-lg.border button:nth-child(3)'); // Ensure timeline
  await page.waitForSelector('.min-w-max', { timeout: 5000 });
  await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-MOBILE.png', fullPage: true });
  console.log('Mobile screenshot saved');

  await browser.close();
})();
