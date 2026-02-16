#!/usr/bin/env node
import puppeteer from 'puppeteer';

async function testCalendar() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // Desktop viewport
    await page.setViewport({ width: 1400, height: 1200 });
    
    console.log('🌐 Loading calendar...');
    await page.goto('http://localhost:3004/kozy/', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if view toggle exists
    const toggles = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
    console.log('📋 Available buttons:', toggles);
    
    // Take screenshot of default view
    await page.screenshot({ path: '/tmp/calendar-default.png' });
    console.log('✅ Default view screenshot saved');
    
    // Try clicking timeline toggle (if it exists)
    const timelineBtn = await page.$('button:has-text("Timeline")');
    if (timelineBtn) {
      await timelineBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.screenshot({ path: '/tmp/calendar-timeline.png' });
      console.log('✅ Timeline view screenshot saved');
    } else {
      console.log('⚠️ Timeline button not found');
    }
    
    // Mobile viewport test
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: '/tmp/calendar-mobile.png' });
    console.log('✅ Mobile view screenshot saved');
    
    await browser.close();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await browser.close();
    throw error;
  }
}

testCalendar();
