const SESSION_KEY = 'ae-duel-lab.demo-account.v1';
const GUEST_KEY = 'ae-duel-lab.decks.v1';
const defaultNames = new Map([['duelist1', 'Duelist One'], ['duelist2', 'Duelist Two'], ['duelist3', 'Duelist Three']]);
const profileKey = id => `ae-duel-lab.profile.v1.${id}`;
const sections = ['main', 'extra', 'side'];

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function activeAccount() {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return defaultNames.has(id) ? id : null;
  } catch { return null; }
}

export async function signIn(username, password, signal) {
  const response = await fetch('/api/demo-login', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password}), signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !defaultNames.has(data.id)) throw new Error(data.error || 'Sign-in is unavailable. Try again.');
  if (signal?.aborted) throw signal.reason;
  return data.id;
}

export function setActiveAccount(id) {
  if (id) sessionStorage.setItem(SESSION_KEY, id);
  else sessionStorage.removeItem(SESSION_KEY);
}

export function readProfile(id) {
  const saved = id ? readJson(profileKey(id), {}) : {decks: readJson(GUEST_KEY, [])};
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
  const profile = readProfile(id);
  const index = profile.decks.findIndex(saved => saved.id === deck.id);
  if (index < 0) profile.decks.push(deck);
  else profile.decks[index] = deck;
  if (id) localStorage.setItem(profileKey(id), JSON.stringify(profile));
  else localStorage.setItem(GUEST_KEY, JSON.stringify(profile.decks));
}
