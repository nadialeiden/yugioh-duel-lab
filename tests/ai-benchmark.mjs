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
const levels = (process.env.AI_BENCHMARK_PAIR || 'expert,standard').split(',');
assert.equal(new Set(levels).size, 2);
assert.equal(levels.length, 2);
assert.ok(levels.every(level => ['beginner','standard','expert'].includes(level)));
const counts = () => ({[levels[0]]: 0, [levels[1]]: 0, draws: 0, unfinished: 0});
const result = counts();

for (const deck of decks) {
  const matchup = counts();
  for (let repeat = 0; repeat < repetitions; repeat++) {
    for (const firstSide of [0, 1]) {
      const seed = [42n + seedOffset + BigInt(repeat), 123n, 456n, 789n];
      const errors = [];
      const session = new DuelSession({cards, readScript, seed, onError: error => errors.push(error.message)});
      try {
        await session.start([deck, deck]);
        for (let i = 0; i < 3500 && !session.closed && !errors.length && session.state.turn <= 20; i++) {
          const prompt = session.state.prompt;
          assert.ok(prompt, deck.id + ' must have an engine decision');
          const difficulty = levels[prompt.player === firstSide ? 0 : 1];
          const response = chooseBot(prompt, session, cards, difficulty);
          assert.ok(response, deck.id + ' must have a bot response');
          session.respond(response);
          if (errors.length) console.error(deck.id, {firstSide, repeat, difficulty, prompt, response}, session.state.log.slice(-8));
        }
        assert.deepEqual(errors, [], deck.id + ' produced an invalid engine response');
        const winner = session.state.winner;
        const key = winner === 0 || winner === 1 ? levels[winner === firstSide ? 0 : 1] : winner === 2 ? 'draws' : 'unfinished';
        matchup[key]++;
        result[key]++;
      } finally { session.destroy(); }
    }
  }
  console.log(deck.id, matchup);
}
console.log('Paired mirrors, identical seeds, both player orders:', result);
if (process.env.AI_BENCHMARK_VERIFY) {
  assert.ok(result[levels[0]] > result[levels[1]], `${levels[0]} should win more mirrors than ${levels[1]} on the fixed benchmark.`);
}
