import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {chooseBot} from '../dist/bot.mjs';
import {describePrompt} from '../dist/choices.mjs';
import {cardName, cards, effectText, systemStrings} from '../dist/data.mjs';
import {DuelSession} from '../dist/engine.mjs';

const assets = file => readFileSync(new URL('../dist/data/' + file, import.meta.url));
for (const card of JSON.parse(assets('catalog.json'))) cards.set(card.code, card);
const {decks} = JSON.parse(assets('starters.json'));
const scripts = JSON.parse(gunzipSync(assets('effects.bin')));
const exosister = decks.find(deck => deck.id === 'exosister-competitive');
const swordsoul = decks.find(deck => deck.id === 'swordsoul');
const [martha, elis, mikailis, pax, ash, betrayal] = [37343995, 16474916, 42741437, 77913594, 14558127, 52335937];
const mainPhase = prompt => prompt?.type === 11 && prompt.player === 0;
const choices = session => describePrompt(session.state.prompt, cardName, effectText).choices;
const option = (session, code, action) => choices(session).find(choice => choice.card?.code === code && choice.response?.action === action);

async function startDuel(t, seed, duelDecks = [exosister, swordsoul]) {
  const session = new DuelSession({
    cards, seed: [seed, 2n, 3n, 4n],
    readScript: name => scripts[name] || scripts['official/' + name] || null,
    onError: error => assert.fail(error.message),
  });
  t.after(() => session.destroy());
  await session.start(duelDecks);
  assert.ok(mainPhase(session.state.prompt));
  assert.ok(session.state.players[0].monsters.every(card => !card));
  return session;
}

function stepUntil(session, done) {
  for (let step = 0; step < 30; step++) {
    const prompt = session.state.prompt;
    if (done(prompt)) return;
    assert.ok(prompt && prompt.type !== 11, 'Expected a follow-up prompt');
    const response = prompt.type === 16 && !prompt.forced ? {type: 8, index: null} : chooseBot(prompt, session, cards);
    assert.ok(session.respond(response));
  }
  assert.fail('The expected prompt did not appear');
}

test('Martha offers separate Normal Summon and hand effect choices on an empty board', async t => {
  const session = await startDuel(t, 4n);
  const normal = option(session, martha, 0);
  const handEffect = option(session, martha, 5);
  assert.equal(normal?.label, 'Normal Summon');
  assert.equal(handEffect?.label, 'Activate · Special Summon');
  assert.match(handEffect.detail, /Special Summon Elis from your Deck/);
  assert.ok(session.respond(normal.response));
  stepUntil(session, mainPhase);
  assert.deepEqual(session.state.players[0].monsters.filter(Boolean).map(card => card.code), [martha]);
});

test('Martha summons Elis and Mikailis offers separate search and banish effects', async t => {
  const session = await startDuel(t, 120n);
  // Put an opposing Ash in the GY so Mikailis has a legal banish target.
  assert.ok(session.respond(option(session, pax, 5).response));
  stepUntil(session, prompt => prompt?.player === 1 && prompt.type === 16 && prompt.selects.some(card => card.code === ash));
  assert.ok(session.respond(choices(session).find(choice => choice.card?.code === ash).response));
  stepUntil(session, mainPhase);
  assert.ok(session.respond(option(session, martha, 5).response));
  stepUntil(session, mainPhase);
  assert.deepEqual(new Set(session.state.players[0].monsters.filter(Boolean).map(card => card.code)), new Set([martha, elis]));

  assert.ok(session.respond(option(session, mikailis, 1).response));
  stepUntil(session, mainPhase);
  const effects = choices(session).filter(choice => choice.card?.code === mikailis && choice.response?.action === 5);
  const search = effects.find(choice => /Detach 1 material.*Spell\/Trap/.test(choice.detail));
  const banish = effects.find(choice => /Banish.*GY/.test(choice.detail));
  assert.ok(search && banish, 'Both effects have distinct descriptions');
  assert.notEqual(search.response.index, banish.response.index);

  assert.ok(session.respond(search.response));
  stepUntil(session, mainPhase);
  assert.equal(session.state.players[0].monsters.find(card => card?.code === mikailis).overlayCards.length, 1);
  const remaining = choices(session).filter(choice => choice.card?.code === mikailis && choice.response?.action === 5);
  assert.equal(remaining.length, 1);
  assert.match(remaining[0].detail, /Banish.*GY/);
  assert.ok(session.respond(remaining[0].response));
  stepUntil(session, mainPhase);
  assert.ok(session.state.players[1].banished.some(card => card.code === ash));
});

test('description decoding still resolves other cards and system prompts', () => {
  systemStrings.set(31n, 'Attack directly?');
  assert.equal(effectText(31n), 'Attack directly?');
  assert.equal(effectText(BigInt(ash) << 20n), cards.get(ash).strings[0]);
  assert.equal(effectText((BigInt(betrayal) << 20n) | 1n), cards.get(betrayal).strings[1]);
});

test('Betrayal identifies adding cards and discarding as separate decisions', async t => {
  const session = await startDuel(t, 4n);
  assert.ok(session.respond(option(session, betrayal, 5).response));
  stepUntil(session, prompt => prompt?.type === 15);
  const add = session.state.prompt;
  assert.equal(add.selectionHint, 506);
  assert.equal(add.min, 2);
  assert.ok(session.respond({type:5,indicies:[0,1]}));
  stepUntil(session, prompt => prompt?.type === 15);
  const discard = session.state.prompt;
  assert.equal(describePrompt(discard).title, 'Discard 1 card');
  assert.equal(discard.drawnBeforeSelection, undefined, 'Cards added to the hand did not come from a draw');
});

test('Celtic Mystic reports the completed draw before asking which cards to discard', async t => {
  const celticMystic = 50073633;
  const rolad = decks.find(deck => deck.id === 'rolad-mitsurugi');
  const session = await startDuel(t, 26n, [rolad, swordsoul]);
  assert.ok(session.respond(option(session, celticMystic, 0).response));
  stepUntil(session, prompt => prompt?.type === 15);
  assert.equal(session.view(1).prompt, null);
  const decision = describePrompt(session.view(0).prompt);
  assert.equal(decision.title, 'Discard 2 cards');
  assert.equal(decision.note, '3 cards drawn.');
  assert.ok(session.respond({type:5,indicies:[0,1]}));
  stepUntil(session, mainPhase);
  assert.equal(session.state.prompt.drawnBeforeSelection, undefined);
});
