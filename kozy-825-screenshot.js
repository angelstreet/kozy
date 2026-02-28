const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  
  async function screenshotPage(page, label, width, height, mobile) {
    if (mobile) {
      await page.setViewport({ width, height, isMobile: true, hasTouch: true });
    } else {
      await page.setViewport({ width, height });
    }
    
    await page.goto('http://localhost:3002/kozy/properties', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    
    const url = page.url();
    const title = await page.title();
    console.log(`${label} URL: ${url}, title: ${title}`);
    
    // Try clicking 3-dot menu on first property
    try {
      const moreBtn = await page.$('button:has(svg.lucide-more-vertical), button[aria-label*="more"]');
      if (moreBtn) {
        await moreBtn.click();
        await new Promise(r => setTimeout(r, 800));
        console.log(`${label}: clicked more menu`);
      } else {
        // Try all buttons with SVG
        const allBtns = await page.$$('button');
        for (const btn of allBtns) {
          const cls = await page.evaluate(el => el.querySelector('svg')?.getAttribute('class') || '', btn);
          if (cls.includes('more-vertical')) {
            await btn.click();
            await new Promise(r => setTimeout(r, 800));
            console.log(`${label}: clicked more-vertical button`);
            break;
          }
        }
      }
    } catch(e) { console.log(`${label} menu click error:`, e.message); }
    
    await page.screenshot({ path: `/tmp/kozy-825-${label}.png`, fullPage: false });
    console.log(`${label} screenshot saved`);
  }
  
  const desktop = await browser.newPage();
  await screenshotPage(desktop, 'desktop', 1280, 800, false);
  
  const mobile = await browser.newPage();
  await screenshotPage(mobile, 'mobile', 375, 812, true);
  
  await browser.close();
})();
