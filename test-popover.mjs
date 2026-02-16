import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
await page.goto('http://localhost:3002/kozy/', { waitUntil: 'networkidle0', timeout: 10000 });
await page.type('input[type="email"]', 'owner@example.com');
await page.type('input[type="password"]', 'user');
await page.click('button[type="submit"]');
await new Promise(r => setTimeout(r, 3000));
await page.goto('http://localhost:3002/kozy/calendar', { waitUntil: 'networkidle0', timeout: 10000 });
await new Promise(r => setTimeout(r, 2000));

// Click on text containing "Sylvie" (bottom booking - tests popover cropping)
const el = await page.evaluateHandle(() => {
  const spans = document.querySelectorAll('span');
  for (const s of spans) {
    if (s.textContent.includes('Sylvie') || s.textContent.includes('Anaïs')) return s.closest('div[class*="cursor"]') || s.parentElement;
  }
  return null;
});
if (el && el.asElement()) {
  await el.asElement().click();
  await new Promise(r => setTimeout(r, 500));
  console.log('Clicked booking');
}

await page.screenshot({ path: '/home/jndoye/.openclaw/media/outbound/task-704-popover-test2.png', fullPage: false });
console.log('Done');
await browser.close();
