const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => { if (msg.type() === 'error') console.log('ERR:', msg.text()); });
  page.on('pageerror', err => console.log('PAGE ERR:', err.message.substring(0, 300)));
  
  await page.setViewport({ width: 1280, height: 800 });
  
  // First just set localStorage
  await page.goto('http://localhost:3002/kozy/', { waitUntil: 'load' });
  
  await page.evaluate(() => {
    localStorage.setItem('kozy_role', 'cleaner');
    localStorage.setItem('kozy_cleaner_id', '15');
  });
  
  // Wait for app to load with role
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  
  const bodyText = await page.evaluate(() => document.body.innerText?.substring(0, 200) || '(empty)');
  console.log('Body text:', bodyText);
  await page.screenshot({ path: '/tmp/kozy-827-debug2.png' });
  
  await browser.close();
})();
