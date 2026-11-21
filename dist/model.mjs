export const SECTIONS = ['main', 'extra', 'side'];
export const emptyDeck = (name = 'Untitled deck') => ({name, main: [], extra: [], side: [], provenance: null});
export const isExtra = c => !!(c?.type & (0x40 | 0x2000 | 0x800000 | 0x4000000));
export const canonical = c => c?.alias && Math.abs(c.alias - c.code) < 10 ? c.alias : c?.code;
export function exportYdk(deck) {
  return ['#created by AE Duel Lab', '#main', ...deck.main, '#extra', ...deck.extra, '!side', ...deck.side, ''].join('\n');
}
export function parseDeck(text, cards = new Map()) {
  const deck = emptyDeck('Imported deck'); let section = 'main'; const errors = [];
  const names = new Map([...cards.values()].map(c => [c.name.toLowerCase(), c.code]));
  if (text.trim().startsWith('ydke://')) {
    const parts = text.trim().slice(7).split('!');
    for (let i = 0; i < 3; i++) {
      let bytes;
      try { bytes = Uint8Array.from(atob(parts[i] || ''), c => c.charCodeAt(0)); } catch { throw new Error('Invalid YDKE link.'); }
      if (bytes.length % 4) throw new Error('Invalid YDKE card data.');
      const view = new DataView(bytes.buffer);
      for (let j = 0; j < bytes.length; j += 4) deck[SECTIONS[i]].push(view.getUint32(j, true));
    }
    return {deck, errors};
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (/^(?:#|!)?main(?: deck)?\s*:?$/i.test(line)) { section = 'main'; continue; }
    if (/^(?:#|!)?extra(?: deck)?\s*:?$/i.test(line)) { section = 'extra'; continue; }
    if (/^(?:#|!)?side(?: deck)?\s*:?$/i.test(line)) { section = 'side'; continue; }
    if (/^[#!]/.test(line)) continue;
    const match = line.match(/^(?:(\d+)\s*x?\s+)?(.+?)(?:\s+x(\d+))?$/i);
    const n = Number(match[1] || match[3] || 1), name = match[2].trim();
    const code = /^\d{1,9}$/.test(name) ? Number(name) : names.get(name.toLowerCase());
    if (!code) { errors.push(`Unknown card: ${name}`); continue; }
    if (!Number.isInteger(n) || n < 1 || n > 60) { errors.push(`Invalid quantity: ${line}`); continue; }
    for (let k = 0; k < n; k++) deck[section].push(code);
  }
  if (SECTIONS.every(s => !deck[s].length)) errors.push('No cards found. Paste a .ydk, ydke:// link, or card names with quantities.');
  return {deck, errors};
}
export function validateDeck(deck, cards, rules, releases = new Map()) {
  const issues = [], counts = new Map();
  if (deck.main.length < 40 || deck.main.length > 60) issues.push('Main Deck must contain 40-60 cards.');
  if (deck.extra.length > 15) issues.push('Extra Deck may contain at most 15 cards.');
  if (deck.side.length > 15) issues.push('Side Deck may contain at most 15 cards.');
  if (!rules?.date || !rules?.limits) issues.push('The AE restriction list is unavailable.');
  for (const section of SECTIONS) for (const id of deck[section]) {
    const c = cards.get(id);
    if (!c) { issues.push(`Unknown card passcode: ${id}`); continue; }
    const key = c.cid ? 'cid:' + c.cid : canonical(c); counts.set(key, (counts.get(key) || 0) + 1);
    if (!(c.ot & 1) || c.ot & (4 | 8 | 16 | 32 | 64 | 256 | 512 | 4096) || c.type & 0x4000) issues.push(`${c.name}: not a released OCG card.`);
    if (section === 'main' && isExtra(c)) issues.push(`${c.name}: belongs in the Extra Deck.`);
    if (section === 'extra' && !isExtra(c)) issues.push(`${c.name}: cannot be in the Extra Deck.`);
    const release = releases.get(id);
    if (!release?.released) issues.push(`${c.name}: ${release?.checked ? 'no released AE printing found' : 'AE printing not verified yet'}.`);
  }
  for (const [id, count] of counts) {
    const c = typeof id === 'string' ? [...cards.values()].find(x => 'cid:' + x.cid === id) : cards.get(id) || [...cards.values()].find(x => canonical(x) === id);
    const limit = rules?.konami_id_limits?.[c?.cid] ?? rules?.limits?.[c?.name] ?? 3;
    if (count > limit) issues.push(`${c?.name || id}: ${count} copies across Main/Extra/Side; AE limit is ${limit}.`);
  }
  return [...new Set(issues)];
}
export function addCard(deck, code, section, cards) {
  const c = cards.get(code); if (!c) throw new Error('Unknown card.');
  if (section !== 'side') section = isExtra(c) ? 'extra' : 'main';
  const key = canonical(c);
  if (SECTIONS.flatMap(s => deck[s]).filter(id => canonical(cards.get(id)) === key).length >= 3) throw new Error('Maximum three copies across all sections.');
  if (deck[section].length >= (section === 'main' ? 60 : 15)) throw new Error('This deck section is full.');
  deck[section].push(code); return section;
}
export function decodePlaces(mask, player) {
  const result = [];
  for (let relative = 0; relative < 2; relative++) for (const location of [4, 8]) {
    const offset = relative * 16 + (location === 8 ? 8 : 0);
    for (let sequence = 0; sequence < (location === 4 ? 7 : 8); sequence++) {
      if (!((mask >>> (offset + sequence)) & 1)) result.push({player: player ^ relative, location, sequence});
    }
  }
  return result;
}
export function safeView(snapshot, viewer) {
  return {...snapshot, prompt: snapshot.prompt?.player === viewer ? snapshot.prompt : null,
    players: snapshot.players.map((p, index) => ({...p,
      hand: index === viewer ? p.hand : p.hand.map(() => ({code: 0, position: 8})),
      extra: index === viewer ? p.extra : p.extra.map(c => !c || c.position & 5 ? c : {code: 0, position: 8}),
      monsters: p.monsters.map(c => !c || index === viewer || c.position & 5 ? c : {code: 0, position: c.position}),
      spells: p.spells.map(c => !c || index === viewer || c.position & 5 ? c : {code: 0, position: c.position}),
      banished: p.banished.map(c => !c || c.position & 5 ? c : {code: 0, position: c.position})
    }))};
}
