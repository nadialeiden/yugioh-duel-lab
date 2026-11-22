import assert from 'node:assert/strict';

export const base = process.env.BASE_URL || 'http://localhost:4173';

export async function enterLab(page, url = base, id = 'duelist1') {
  const response = await page.request.post(new URL('/api/demo-login', url).href, {
    data: {username: id, password: id === 'duelist1' ? 'DuelLab-101!' : 'DuelLab-102!'},
  });
  assert.equal(response.status(), 200, await response.text());
  await page.goto(url);
}
