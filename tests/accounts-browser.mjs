import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : undefined),
  headless: true,
});
const base = process.env.BASE_URL || 'http://localhost:4173';
try {
  const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/#decks');
  const account = page.locator('#account-button');
  await page.getByRole('heading', {name: 'Enter the lab'}).waitFor();
  assert.equal(new URL(page.url()).pathname, '/signin.html');
  assert.equal(new URL(page.url()).hash, '#decks');
  assert.equal(await page.locator('#start-practice').count(), 0);
  assert.equal((await page.request.get(base + '/data/catalog.json', {maxRedirects: 0})).status(), 303);
  assert.doesNotMatch(await page.locator('body').innerText(), /DuelLab-10/);
  const deckList = page.locator('#saved-decks');
  const accountName = name => page.getByRole('button', {name: `Account settings for ${name}`, exact: true});

  async function login(id, password) {
    await page.locator('#login-id').fill(id);
    await page.locator('#login-password').fill(password);
    await page.locator('#demo-login button[type="submit"]').click();
  }
  async function logout() {
    await account.click();
    await page.locator('#account-logout').click();
    await page.getByRole('button', {name: 'Sign in', exact: true}).waitFor();
    assert.equal((await page.request.get(base + '/api/demo-login')).status(), 401);
  }
  async function buildDeck(name) {
    await page.locator('#create-deck').click();
    await page.locator('#deck-name').fill(name);
    await page.locator('#card-search').fill('Exosister Martha');
    await page.getByRole('button', {name: 'Add Exosister Martha', exact: true}).click();
    await page.locator('#save-deck').click();
    await deckList.getByRole('button', {name: new RegExp(name)}).waitFor();
  }

  await login('duelist1', 'wrong-password');
  await page.getByRole('alert').filter({hasText: 'Login ID or password is incorrect.'}).waitFor();
  await page.locator('#login-password').fill('DuelLab-101!');
  await page.locator('#demo-login button[type="submit"]').click();
  await accountName('Duelist One').waitFor();
  assert.equal(new URL(page.url()).hash, '#decks');
  const authCookie = (await page.context().cookies()).find(cookie => cookie.name === 'duel_session');
  assert.equal(authCookie.httpOnly, true);
  assert.equal(authCookie.secure, base.startsWith('https:'));
  await account.click();
  await page.locator('#account-name').fill('Martha Practice');
  await page.getByRole('button', {name: 'Save name', exact: true}).click();
  await accountName('Martha Practice').waitFor();
  await buildDeck('Account One Deck');
  await page.reload();
  await accountName('Martha Practice').waitFor();
  await deckList.getByRole('button', {name: /Account One Deck/}).waitFor();
  await logout();

  await login('duelist2', 'DuelLab-102!');
  await accountName('Duelist Two').waitFor();
  assert.doesNotMatch(await deckList.textContent(), /Account One Deck/);
  await buildDeck('Account Two Deck');
  await logout();
  await login('duelist3', 'DuelLab-103!');
  await accountName('Duelist Three').waitFor();
  assert.doesNotMatch(await deckList.textContent(), /Account One Deck|Account Two Deck/);
  await logout();
  await login('duelist1', 'DuelLab-101!');
  await accountName('Martha Practice').waitFor();
  await deckList.getByRole('button', {name: /Account One Deck/}).click();
  assert.equal(await page.locator('#count-main').textContent(), '1');
  assert.doesNotMatch(await deckList.textContent(), /Account Two Deck/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await logout();
  await page.emulateMedia({reducedMotion: 'reduce'});
  assert.equal(await page.locator('.duel-card.center').evaluate(node => getComputedStyle(node).animationName), 'none');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', {name: 'Continue as guest'}).click();
  await page.getByRole('button', {name: 'Guest pass'}).waitFor();
  assert.equal(new URL(page.url()).hash, '#practice');
  assert.equal(await page.getByRole('button', {name: 'Local duel', exact: true}).isVisible(), false);
  assert.equal(await page.getByRole('button', {name: 'Deck workshop', exact: true}).isVisible(), false);
  await page.getByRole('button', {name: 'Learn the interface', exact: true}).first().click();
  assert.equal(new URL(page.url()).hash, '#learn');
  await page.getByRole('button', {name: 'Guest pass'}).click();
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  await login('duelist1', 'DuelLab-101!');
  await accountName('Martha Practice').waitFor();
  await logout();
  await page.getByRole('button', {name: 'Continue as guest'}).click();
  await page.getByRole('alert').filter({hasText: 'This browser has used its guest pass for today.'}).waitFor();
  assert.deepEqual(errors, []);
  console.log('Mobile entry, three accounts, profile isolation, reduced motion, and browser guest limit passed.');
} finally {
  await browser.close();
}
