const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1400,1200'] 
  });
  const page = await browser.newPage();

  try {
    // Go to sign-in (note: redirects to /kozy/)
    await page.goto('http://localhost:3002/kozy/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Login
    await page.type('input[type="email"]', 'user', { delay: 50 });
    await page.type('input[type="password"]', 'user', { delay: 50 });
    await page.click('button[type="submit"]', { timeout: 5000 });
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log('Login wait skipped:', e.message));

    // Go to owner calendar
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('h1, [class*="text-.*xl"][class*="font-bold"], .calendar-view, text=/Calendar/', { timeout: 10000 });

    // Switch to timeline view if available (nth-child(3) from previous scripts)
    await page.waitForTimeout(1000);
    // Skip timeline toggle for now, assume default is calendar
// const timelineButton = await page.waitForSelector('div.flex.rounded-lg.border button:nth-child(3), button[aria-label*="timeline"], [role="button"]:has-text("Timeline")', { timeout: 5000 }).catch(() => null);
// if (timelineButton) {
//   await timelineButton.click();
//   await page.waitForTimeout(2000);
// }
    if (timelineButton) {
      await timelineButton.click();
      await page.waitForTimeout(2000);
    }

    // Ensure Feb 2026 is visible - since current date is 2026-02-16, default should show it
    // Scroll or navigate if needed, but assume default view shows Feb 15-16
    await page.waitForTimeout(1500); // Allow load/animations

    // Take full page screenshot focusing on calendar
    await page.setViewport({ width: 1400, height: 1200 });
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true });
    console.log('✅ Screenshot saved to /home/jndoye/shared/projects/kozy/TASK-691-FIXED.png');
    console.log('Check for Feb 15-16 dates WITHOUT "Dieudonne" booking');
  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-ERROR.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
