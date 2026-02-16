const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    console.log('1. Going to sign-in...');
    await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-step1-signin.png', fullPage: true });

    console.log('2. Typing credentials...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'user', { delay: 50 });
    await page.type('input[type="password"]', 'user', { delay: 50 });
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-step2-login.png', fullPage: true });

    console.log('3. Clicking submit...');
    await page.click('button[type="submit"], button', { timeout: 5000 });
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log('Login nav skipped:', e.message));
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-step3-postlogin.png', fullPage: true });

    console.log('4. Going to calendar...');
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-step4-calendar.png', fullPage: true });

    console.log('5. Switching to timeline if available...');
    await page.setViewport({ width: 1400, height: 1200 });
    const timelineToggle = await page.waitForSelector('.rounded-lg button:nth-child(3)', { timeout: 5000 }).catch(() => null);
    if (timelineToggle) {
      await timelineToggle.click();
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(1500);

    console.log('6. Taking final screenshot...');
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true });
    console.log('✅ Screenshot saved to /home/jndoye/shared/projects/kozy/TASK-691-FIXED.png');
    console.log('Verify Feb 15-16 has no "Dieudonne" booking.');
  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-ERROR.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
