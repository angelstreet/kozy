const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG: ' + msg.text()));
  const delay = ms => new Promise(r => setTimeout(r, ms));

  try {
    // Login first
    await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    await page.type('input[type="email"]', 'user');
    await page.type('input[type="password"]', 'user');
    await delay(500);
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') || [...document.querySelectorAll('button')].find(b => /sign/i.test(b.textContent));
      btn && btn.click();
    });
    await delay(5000); // Wait for login

    // Go to calendar
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(5000); // Wait for data fetch

    // Toggle to timeline if present
    await page.evaluate(() => {
      const container = document.querySelector('div.flex.rounded-lg.border');
      if (container) {
        const buttons = container.querySelectorAll('button');
        if (buttons[2]) buttons[2].click();
      }
    });
    await delay(3000);

    // Screenshot
    await page.setViewport({ width: 1440, height: 1200 });
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true });

    // Verify
    const text = await page.evaluate(() => document.body.innerText);
    console.log('Dieudonne present?', text.toLowerCase().includes('dieudonne'));
    console.log('Feb 15/16?', /15|16[\\s-]*f[eé]b|févr/i.test(text));
    console.log('✅ Screenshot saved to /home/jndoye/shared/projects/kozy/TASK-691-FIXED.png');
  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-ERROR.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
