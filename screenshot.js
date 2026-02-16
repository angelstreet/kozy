import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  
  // Navigate to Kozy frontend
  await page.goto('http://localhost:5174/kozy/', { waitUntil: 'networkidle2' });
  
  // Wait a bit for content to load
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/kozy-unified-sync.png', fullPage: true });
  
  console.log('Screenshot saved to /tmp/kozy-unified-sync.png');
  
  await browser.close();
})();
