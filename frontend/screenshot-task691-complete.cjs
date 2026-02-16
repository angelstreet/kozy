const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']});
  const page = await browser.newPage();
  const delay = ms => new Promise(r => setTimeout(r, ms));
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    console.log('Navigating to calendar view...');
    await page.goto('http://localhost:3002/kozy/owner/calendar', {waitUntil: 'domcontentloaded', timeout: 30000});
    await delay(5000);

    // Attempt login if needed
    if (await page.$('input[type="email"]')) {
      console.log('Login detected, logging in...');
      await page.type('input[type="email"]', 'user');
      await page.type('input[type="password"]', 'user');
      await page.keyboard.press('Enter');
      await delay(5000);
    }

    await delay(5000); // Wait for data load

    // Toggle timeline view
    await page.evaluate(() => {
      const cont = document.querySelector('div[class*="flex"][class*="rounded-lg"][class*="border"]');
      if (cont) {
        const btns = cont.querySelectorAll('button');
        if (btns.length >= 3) btns[2].click();
      }
    });
    await delay(3000);

    await page.setViewport({width: 1440, height: 1200});
    await page.screenshot({path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true});
    const text = await page.evaluate(() => document.body.innerText.toLowerCase());
    console.log('Dieudonne?', text.includes('dieudonne'));
    console.log('Feb 15-16?', /15 feb|16 feb|15-16|févr 15|févr 16/i.test(text));
    console.log('✅ Task #691 screenshot saved!');
  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true});
    console.log('Screenshot saved despite error.');
  } finally {
    await browser.close();
  }
})();
