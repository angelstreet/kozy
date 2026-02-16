const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();

  // Ensure clean login
  await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.type('input[type="email"]', 'user');
  await page.type('input[type="password"]', 'user');
  await page.click('button:visible');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => console.log('Login navigation timeout, continuing'));
  
  await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 10000 }); // Calendar title

  // Wait for toggle buttons
  await page.waitForSelector('.flex.rounded-lg.border button', { timeout: 5000 });

  // Desktop: Timeline view
  await page.setViewport({ width: 1400, height: 1200 });
  const toggleButtons = await page.$$('.flex.rounded-lg.border button');
  if (toggleButtons.length >= 3) {
    await toggleButtons[2].click();
    await page.waitForTimeout(2000); // Animation/Rerender
  }
  await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-DESKTOP.png', fullPage: true });
  console.log('✅ DESKTOP saved: /home/jndoye/shared/projects/kozy/TASK-703-DESKTOP.png');

  // Mobile: Timeline view
  await page.setViewport({ width: 375, height: 667 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1');
  const mobileToggleButtons = await page.$$('.flex.rounded-lg.border button');
  if (mobileToggleButtons.length >= 3) {
    await mobileToggleButtons[2].click();
    await page.waitForTimeout(2000);
  }
  // Scroll a bit to show timeline content
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-MOBILE.png', fullPage: true });
  console.log('✅ MOBILE saved: /home/jndoye/shared/projects/kozy/TASK-703-MOBILE.png');

  await browser.close();
})();
