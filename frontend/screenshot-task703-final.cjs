const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1400,1200'] 
  });
  const page = await browser.newPage();

  try {
    // Go to sign-in
    await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Login
    await page.type('input[type="email"]', 'user', { delay: 50 });
    await page.type('input[type="password"]', 'user', { delay: 50 });
    await page.click('button[type="submit"], button', { timeout: 5000 });
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log('Login wait skipped:', e.message));

    // Go to calendar
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('h1, [class*="text-xl"][class*="font-bold"]', { timeout: 10000 });

    // Desktop Timeline
    await page.setViewport({ width: 1400, height: 1200 });
    const timelineToggle = await page.waitForSelector('.rounded-lg button:nth-child(3)', { timeout: 5000 });
    await timelineToggle.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-DESKTOP.png', fullPage: true });
    console.log('✅ DESKTOP saved');

    // Mobile Timeline
    await page.setViewport({ width: 375, height: 667 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { timeout: 5000 });
    const mobileToggle = await page.waitForSelector('.rounded-lg button:nth-child(3)', { timeout: 5000 });
    await mobileToggle.click();
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-MOBILE.png', fullPage: true });
    console.log('✅ MOBILE saved');
  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-703-ERROR.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
