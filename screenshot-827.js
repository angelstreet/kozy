const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  
  async function takeShot(viewport, isMobile, outPath) {
    const page = await browser.newPage();
    await page.setViewport({ ...viewport, isMobile: !!isMobile, hasTouch: !!isMobile });
    
    await page.goto('http://localhost:3002/kozy/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('kozy_role', 'cleaner');
      localStorage.setItem('kozy_cleaner_id', '15');
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.goto('http://localhost:3002/kozy/c/notifications', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({ path: outPath, fullPage: false });
    console.log('Shot:', outPath);
    await page.close();
  }

  await takeShot({ width: 1280, height: 800 }, false, '/tmp/kozy-827-desktop.png');
  await takeShot({ width: 375, height: 812 }, true, '/tmp/kozy-827-mobile.png');

  await browser.close();
  console.log('Done');
})();
