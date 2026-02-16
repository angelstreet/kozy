const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002/kozy/owner/calendar', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for SPA load
    await page.setViewport({ width: 1440, height: 1200 });
    await page.waitForTimeout(3000); // Wait for data load
    await page.screenshot({ path: '/home/jndoye/shared/projects/kozy/TASK-691-FIXED.png', fullPage: true });
    const text = await page.evaluate(() => document.body.innerText);
    console.log('Dieudonne?', text.includes('Dieudonne'));
    console.log('Feb?', /15.*16|16.*15/i.test(text));
    console.log('✅ Screenshot saved!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
