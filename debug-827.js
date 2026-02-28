const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3002/kozy/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('kozy_role', 'cleaner');
    localStorage.setItem('kozy_cleaner_id', '15');
  });
  await page.goto('http://localhost:3002/kozy/c/notifications', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '/tmp/kozy-827-debug.png' });
  
  const html = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
  console.log('Body:', html);
  
  await browser.close();
})();
