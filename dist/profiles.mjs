export const sessionEndpoint = '/api/demo-login';
const defaultNames = new Map([['duelist1', 'Duelist One'], ['duelist2', 'Duelist Two'], ['duelist3', 'Duelist Three']]);
const profileKey = id => `ae-duel-lab.profile.v1.${id}`;
const sections = ['main', 'extra', 'side'];

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export async function readSession() {
  const response = await fetch(sessionEndpoint);
  if (!response.ok) return null;
  const session = await response.json();
  return (defaultNames.has(session.id) || session.id === 'guest') && Number.isFinite(session.expires) ? session : null;
}

export function readProfile(id) {
  const saved = defaultNames.has(id) ? readJson(profileKey(id), {}) : {};
  const decks = Array.isArray(saved.decks) ? saved.decks.filter(deck =>
    deck && typeof deck.name === 'string' && sections.every(section =>
      Array.isArray(deck[section]) && deck[section].length <= 60 && deck[section].every(Number.isInteger))) : [];
  const name = typeof saved.name === 'string' ? saved.name.trim().slice(0, 32) : '';
  return {name: name || defaultNames.get(id) || 'Guest', decks};
}

export function saveDisplayName(id, value) {
  const name = value.trim();
  if (!defaultNames.has(id)) throw new Error('Sign in to set a display name.');
  if (!name || name.length > 32) throw new Error('Enter a display name between 1 and 32 characters.');
  localStorage.setItem(profileKey(id), JSON.stringify({...readProfile(id), name}));
}

export function saveProfileDeck(id, deck) {
  if (!defaultNames.has(id)) throw new Error('Sign in to save a deck.');
  const profile = readProfile(id);
  const index = profile.decks.findIndex(saved => saved.id === deck.id);
  if (index < 0) profile.decks.push(deck);
  else profile.decks[index] = deck;
  localStorage.setItem(profileKey(id), JSON.stringify(profile));
}
