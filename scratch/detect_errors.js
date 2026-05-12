const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 5000 });
    // Wait a bit for the game to run a few frames
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('Timeout/Load error:', e.message);
  }

  if (errors.length > 0) {
    console.log('--- CONSOLE ERRORS FOUND ---');
    errors.forEach(e => console.log(e));
    console.log('--- END ERRORS ---');
  } else {
    console.log('No console errors detected.');
  }

  await browser.close();
  process.exit(0);
})();
