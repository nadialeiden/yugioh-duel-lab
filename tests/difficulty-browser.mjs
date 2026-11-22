import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : undefined),
  headless: true,
});
try {
  const base = process.env.BASE_URL || 'http://localhost:4173';
  for (const [width, height, difficulty] of [[320, 667, 'expert'], [390, 844, 'beginner'], [1440, 1000, 'standard']]) {
    const page = await browser.newPage({viewport: {width, height}, isMobile: width < 780, acceptDownloads: true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('#start-practice:enabled').waitFor();
    const selector = page.getByLabel('AI difficulty');
    assert.deepEqual(await selector.locator('option').allTextContents(), ['Beginner', 'Standard', 'Expert']);
    assert.equal(await selector.inputValue(), 'standard');
    await selector.selectOption(difficulty);
    assert.ok(await page.locator('#difficulty-note').textContent());
    await page.locator('#turn-order').selectOption('second');
    await page.locator('#start-practice').click();
    await page.waitForFunction(() => document.querySelector('#arena').classList.contains('live-duel'));
    await page.waitForFunction(() => document.querySelector('#turn-marker strong').textContent === 'Turn 1');
    assert.equal(await page.locator('#opponent-role').textContent(), difficulty.toUpperCase() + ' AI');
    await page.locator('#evaluation-tab').click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export review', exact: true}).click();
    const stream = await (await download).createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(chunks)).difficulty, difficulty);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(`${width}px: ${difficulty} starts a real practice duel and appears in its review.`);
    await page.close();
  }
} finally { await browser.close(); }
