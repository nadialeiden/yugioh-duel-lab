import { unzipSync, strFromU8 } from './vendor/fflate.mjs';

export const cards = new Map();
export const releases = new Map();
export let rules = null;
export let scripts = null;
export const systemStrings = new Map();
let catalogJob, scriptJob;
export async function loadCatalog(progress = () => {}) {
  if (catalogJob) return catalogJob;
  catalogJob = (async () => {
    progress('Loading the card library…');
    const [list, listRules, starters] = await Promise.all([
      fetch('./data/catalog.json').then(check).then(r => r.json()),
      fetch('./data/ae-rules.json').then(check).then(r => r.json()),
      fetch('./data/starters.json').then(check).then(r => r.json())
    ]);
    list.forEach(c => cards.set(c.code, c)); rules = listRules;
    for (const [id, evidence] of Object.entries(starters.releases || {})) releases.set(+id, evidence);
    try {
      const text = await fetch('./data/strings.conf').then(check).then(r => r.text());
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^!system\s+(\d+)\s+(.+)$/); if (m) systemStrings.set(BigInt(m[1]), m[2]);
      }
    } catch { /* Numeric fallback remains available for undocumented system hints. */ }
    return starters;
  })();
  try { return await catalogJob; } catch (e) { catalogJob = null; throw e; }
}
export function loadScripts(progress = () => {}) {
  if (scriptJob) return scriptJob;
  scriptJob = (async () => {
    progress('Loading card effects…');
    const buffer = await fetch('./data/scripts.zip').then(check).then(r => r.arrayBuffer());
    const files = unzipSync(new Uint8Array(buffer), {filter: f => f.name.endsWith('.lua')});
    scripts = new Map();
    for (const [path, bytes] of Object.entries(files)) {
      const name = path.split('/').slice(1).join('/'); scripts.set(name, strFromU8(bytes));
    }
    return scripts;
  })();
  return scriptJob.catch(e => { scriptJob = null; throw e; });
}
export function readScript(name) { return scripts?.get(name) ?? scripts?.get('official/' + name) ?? null; }
export function coreCard(id) {
  const card = cards.get(id); return card ? {...card, race: BigInt(card.race)} : null;
}
export function cardName(id) { return cards.get(id)?.name || (id ? 'Card ' + id : 'Face-down card'); }
export function effectText(description) {
  const id = BigInt(description || 0);
  if (id < 10000n) return systemStrings.get(id) || 'Choose an option (' + id + ')';
  return cards.get(Number(id >> 4n))?.strings[Number(id & 15n)] || 'Activate this card’s effect';
}
export async function verifyRelease(id) {
  if (releases.get(id)?.checked) return releases.get(id);
  const response = await fetch('/api/ae-card?code=' + id).then(check).then(r => r.json());
  if (response.error) throw new Error(response.error);
  releases.set(id, response); return response;
}
export async function verifyDeck(deck, progress = () => {}) {
  const ids = [...new Set([...deck.main, ...deck.extra, ...deck.side])];
  let completed = 0; const failures = [];
  const work = async () => {
    while (ids.length) {
      const id = ids.shift();
      try { await verifyRelease(id); } catch (error) { failures.push(cardName(id) + ': ' + error.message); }
      progress('Verifying AE printings… ' + (++completed));
    }
  };
  await Promise.all([work(), work()]); return failures;
}
function check(response) { if (!response.ok) throw new Error('Could not load ' + response.url.split('/').pop() + ' (' + response.status + ').'); return response; }
