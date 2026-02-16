const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG: ' + msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR: ' + err.message));

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // 1. Go to sign-in
    console.log('1. Loading sign-in page...');
    await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1000);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-1-signin.png' });

    // 2. Fill login
    console.log('2. Filling login...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.type('input[type="email"], input[name="email"]', 'user');
    await page.type('input[type="password"], input[name="password"]', 'user');
    await delay(500);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-2-filled.png' });

    // 3. Submit
    console.log('3. Submitting...');
    await page.click('button[type="submit"], button:visible', { timeout: 5000 });
    await delay(3000);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-3-postsubmit.png' });

    // 4. Go to calendar
    console.log('4. Navigating to calendar...');
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-4-calendar.png' });

    // 5. Switch to timeline view (button 3 in flex rounded border)
    console.log('5. Switching view...');
    const timelineBtn = await page.waitForSelector('div[class*="flex"][class*="rounded"][class*="border"] button:nth-child(3)', { timeout: 5000 }).catch(() => null);
    if (timelineBtn) {
      await timelineBtn.click();
      await delay(2000);
      console.log('Timeline clicked');
    } else {
      console.log('No timeline button found');
    }

    // 6. Final screenshot
    await page.setViewport({ width: 1440, height: 1024 });
    await delay(1000);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true });
    console.log('✅ FIXED screenshot saved!');

    // Bonus: check text
    const text = await page.evaluate(() => document.body.innerText);
    console.log('Dieudonne in page?', text.includes('Dieudonne'));
    console.log('Feb 15/16?', /15.*16|16.*15|févr.*15|févr.*16/i.test(text));

  } catch (e) {
    console.error('SCRIPT ERROR:', e.message);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-ERROR.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
