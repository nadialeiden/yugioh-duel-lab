import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {DuelSession} from '../dist/engine.mjs';
import {chooseBot} from '../dist/bot.mjs';

const read = name => fs.readFileSync(new URL('../dist/data/' + name, import.meta.url));
const cards = new Map(JSON.parse(read('catalog.json')).map(card => [card.code, card]));
const decks = JSON.parse(read('starters.json')).decks;
const scripts = JSON.parse(gunzipSync(read('effects.bin')));
const readScript = name => scripts[name] || scripts['official/' + name] || null;
const repetitions = Number(process.env.AI_BENCHMARK_SEEDS || 4);
const seedOffset = BigInt(process.env.AI_BENCHMARK_OFFSET || 0);
const result = {expert: 0, standard: 0, unfinished: 0};

for (const deck of decks) {
  const matchup = {expert: 0, standard: 0, unfinished: 0};
  for (let repeat = 0; repeat < repetitions; repeat++) {
    for (const expertSide of [0, 1]) {
      const seed = [42n + seedOffset + BigInt(repeat), 123n, 456n, 789n];
      const errors = [];
      const session = new DuelSession({cards, readScript, seed, onError: error => errors.push(error.message)});
      try {
        await session.start([deck, deck]);
        for (let i = 0; i < 3500 && !session.closed && !errors.length && session.state.turn <= 20; i++) {
          const prompt = session.state.prompt;
          assert.ok(prompt, deck.id + ' must have an engine decision');
          const difficulty = prompt.player === expertSide ? 'expert' : 'standard';
          const response = chooseBot(prompt, session, cards, difficulty);
          assert.ok(response, deck.id + ' must have a bot response');
          session.respond(response);
          if (errors.length) console.error(deck.id, {expertSide, repeat, difficulty, prompt, response}, session.state.log.slice(-8));
        }
        assert.deepEqual(errors, [], deck.id + ' produced an invalid engine response');
        const winner = session.state.winner;
        const key = winner === 0 || winner === 1 ? winner === expertSide ? 'expert' : 'standard' : 'unfinished';
        matchup[key]++;
        result[key]++;
      } finally { session.destroy(); }
    }
  }
  console.log(deck.id, matchup);
}
console.log('Paired mirrors, identical seeds, both player orders:', result);
if (process.env.AI_BENCHMARK_VERIFY) assert.ok(result.expert > result.standard, 'Expert should beat Standard more often on the fixed benchmark.');
