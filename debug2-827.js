const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  // Capture network failures
  page.on('requestfailed', req => console.log('FAIL:', req.url(), req.failure()?.errorText));
  page.on('response', async resp => {
    if (resp.status() >= 400) console.log('HTTP ERR:', resp.status(), resp.url().replace('http://localhost:3002', ''));
  });
  page.on('pageerror', err => console.log('PAGE ERR:', err.message.substring(0, 200)));
  
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3002/kozy/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('kozy_role', 'cleaner');
    localStorage.setItem('kozy_cleaner_id', '15');
  });
  await page.goto('http://localhost:3002/kozy/c/notifications', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
