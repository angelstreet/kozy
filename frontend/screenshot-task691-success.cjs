const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security'] 
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log('1. Direct goto calendar...');
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-direct.png', fullPage: true });

    if (currentUrl.includes('sign-in') || currentUrl.includes('login')) {
      console.log('2. Login required, logging in...');
      await page.type('input[type="email"]', 'user');
      await page.type('input[type="password"]', 'user');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000); // Short wait instead of navigation
      await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    console.log('3. Waiting for calendar content...');
    await page.waitForSelector('h1, .text-xl.font-bold, [class*="calendar"], body', { timeout: 10000 });
    await page.setViewport({ width: 1400, height: 1200 });
    await page.waitForTimeout(2000);

    // Try to switch to timeline view
    console.log('4. Looking for view toggle...');
    const viewButtons = await page.$$eval('div[class*="flex"] button', buttons => buttons.map((b, i) => ({i: i+1, text: b.textContent.trim()})));
    console.log('View buttons:', JSON.stringify(viewButtons));
    const timelineButtonIndex = viewButtons.findIndex(b => b.text.toLowerCase().includes('timeline') || b.text.toLowerCase().includes('time'));
    if (timelineButtonIndex !== -1) {
      const selector = `div[class*="flex"] button:nth-child(${timelineButtonIndex + 1})`;
      await page.click(selector);
      await page.waitForTimeout(2000);
      console.log('Clicked timeline button');
    }

    // Check content for Dieudonne and dates
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const hasDieudonne = bodyText.includes('dieudonne');
    const hasFeb15 = bodyText.includes('15 feb') || bodyText.includes('15/2') || bodyText.includes('15 fév');
    const hasFeb16 = bodyText.includes('16 feb') || bodyText.includes('16/2') || bodyText.includes('16 fév');
    console.log('Has Dieudonne:', hasDieudonne);
    console.log('Has Feb 15:', hasFeb15);
    console.log('Has Feb 16:', hasFeb16);

    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true });
    console.log('✅ Screenshot saved to /home/jndoye/shared/projects/kozy/TASK-691-FIXED.png');
  } catch (e) {
    console.error('ERROR:', e.message);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-ERROR.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
