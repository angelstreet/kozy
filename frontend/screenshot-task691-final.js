const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE: ' + msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR: ' + err.message));

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Go to sign-in
    await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-signin.png', fullPage: true });

    // Login
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'user');
    await page.type('input[type="password"]', 'user');
    await delay(500);

    // Click submit - use evaluate for reliable click
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('sign in'));
      if (btn) btn.click();
    });
    await delay(4000);

    // Go to calendar
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(4000);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-calendar.png', fullPage: true });

    // Optional timeline
    await page.evaluate(() => {
      const container = document.querySelector('div[class*="flex"][class*="rounded"][class*="border"]');
      if (container) {
        const btns = container.querySelectorAll('button');
        if (btns[2]) btns[2].click(); // nth-child(3)
      }
    });
    await delay(3000);

    // Final screenshot
    await page.setViewport({ width: 1440, height: 1200 });
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true });

    // Check
    const text = await page.evaluate(() => document.body.innerText);
    const hasDieudonne = text.toLowerCase().includes('dieudonne');
    const hasFeb = /15|16\s*f[eé]b|févr/i.test(text);
    console.log('Dieudonne present?', hasDieudonne);
    console.log('Feb dates?', hasFeb);
    console.log('✅ Screenshot saved!');
  } catch (e) {
    console.error('ERROR:', e.message);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-ERROR.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
