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

// Screenshot calendar view
await page.screenshot({ path: '/home/jndoye/.openclaw/media/outbound/kozy-calendar-view.png', fullPage: false });

// Click Timeline button
const timelineBtn = await page.evaluateHandle(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) if (b.textContent.includes('Timeline')) return b;
  return null;
});
if (timelineBtn && timelineBtn.asElement()) {
  await timelineBtn.asElement().click();
  await new Promise(r => setTimeout(r, 1000));
}

await page.screenshot({ path: '/home/jndoye/.openclaw/media/outbound/kozy-timeline-view.png', fullPage: false });
console.log('Done');
await browser.close();
