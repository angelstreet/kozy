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
    
    console.log('🌐 Loading calendar (desktop)...');
    await page.goto('http://localhost:3004/kozy/', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take desktop screenshot
    await page.screenshot({ path: '/tmp/kozy-calendar-desktop.png', fullPage: false });
    console.log('✅ Desktop screenshot saved');
    
    // Mobile viewport test
    console.log('📱 Testing mobile view...');
    await page.setViewport({ width: 375, height: 667 });
    await page.goto('http://localhost:3004/kozy/', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: '/tmp/kozy-calendar-mobile.png', fullPage: false });
    console.log('✅ Mobile screenshot saved');
    
    await browser.close();
    console.log('✅ Test complete');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await browser.close();
    throw error;
  }
}

testCalendar();
