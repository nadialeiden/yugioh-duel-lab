import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDeck,exportYdk,validateDeck,safeView,decodePlaces} from '../dist/model.mjs';
import {selectionValid,selectionResponse,describePrompt} from '../dist/choices.mjs';
import {shuffledDeck} from '../dist/engine.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url),'utf8'));
const cards=new Map(catalog.map(c=>[c.code,c]));
const data=JSON.parse(fs.readFileSync(new URL('../dist/data/starters.json',import.meta.url),'utf8'));
const rules=JSON.parse(fs.readFileSync(new URL('../dist/data/ae-rules.json',import.meta.url),'utf8'));
const releases=new Map(Object.entries(data.releases).map(([id,r])=>[+id,r]));
test('all bundled decks satisfy the actual AE pool and combined restriction list',()=>{
  for(const deck of data.decks)assert.deepEqual(validateDeck(deck,cards,rules,releases),[]);
});
test('AE restrictions count main, extra, and side together using Konami identities',()=>{
  const deck=structuredClone(data.decks[0]),ash=catalog.find(c=>c.name==='Ash Blossom & Joyous Spring');deck.side.push(ash.code);
  assert.ok(validateDeck(deck,cards,rules,releases).some(m=>m.includes('AE limit is 2')));
});
test('unverified AE release is refused independently of OCG availability',()=>{
  const deck=structuredClone(data.decks[0]);const unverified=catalog.find(c=>!c.ae&&!c.alias&&!(c.type&0x4000));deck.main[0]=unverified.code;
  assert.ok(validateDeck(deck,cards,rules,releases).some(m=>m.includes('AE printing not verified')));
});
test('different passcodes for one identity cannot bypass copy limits',()=>{
  const deck=structuredClone(data.decks[0]),ash=catalog.find(c=>c.name==='Ash Blossom & Joyous Spring');
  const alternate={...ash,code:99999998,alias:0};const fixture=new Map(cards);fixture.set(alternate.code,alternate);
  const verified=new Map(releases);verified.set(alternate.code,{checked:true,released:true});deck.side.push(alternate.code);
  assert.ok(validateDeck(deck,fixture,rules,verified).some(m=>m.includes('AE limit is 2')));
});
test('YDK import/export retains all sections; text lists retain quantities and report unknown names',()=>{
  const deck=data.decks[0];assert.deepEqual(parseDeck(exportYdk(deck),cards).deck.main,deck.main);assert.deepEqual(parseDeck(exportYdk(deck),cards).deck.extra,deck.extra);
  const result=parseDeck('Main Deck\n3 Exosister Martha\nExtra Deck\n2 Exosister Mikailis\nSide Deck\n1 Not a Card',cards);
  assert.equal(result.deck.main.length,3);assert.equal(result.deck.extra.length,2);assert.equal(result.errors.length,1);
});
test('opening-deck shuffle is reproducible, preserves copies, and changes seed',()=>{
  const main=data.decks[0].main;
  assert.deepEqual(shuffledDeck(main,[1n,2n]),shuffledDeck(main,[1n,2n]));
  assert.notDeepEqual(shuffledDeck(main,[1n,2n]),main);assert.notDeepEqual(shuffledDeck(main,[1n,2n]),shuffledDeck(main,[2n,3n]));
  assert.deepEqual(shuffledDeck(main,[1n]).sort((a,b)=>a-b),main.slice().sort((a,b)=>a-b));
});
test('opponent hidden information never appears in a player snapshot',()=>{
  const base={hand:[{code:7,position:8}],extra:[{code:8,position:8}],monsters:[{code:9,position:8},{code:10,position:1},null],spells:[{code:11,position:8}],banished:[{code:12,position:8}],grave:[{code:13,position:1}]};
  const view=safeView({players:[base,base],prompt:{player:1,selects:[{code:99}]}},0);
  assert.equal(view.prompt,null);assert.equal(view.players[1].hand[0].code,0);assert.equal(view.players[1].extra[0].code,0);assert.equal(view.players[1].monsters[0].code,0);assert.equal(view.players[1].monsters[1].code,10);assert.equal(view.players[1].spells[0].code,0);assert.equal(view.players[1].banished[0].code,0);assert.equal(view.players[0].hand[0].code,7);
});
test('zone mask decodes from the selecting player perspective',()=>{
  const mask=(0xffffffff^1^(1<<18))>>>0;const places=decodePlaces(mask,1);
  assert.deepEqual(places,[{player:1,location:4,sequence:0},{player:0,location:4,sequence:2}]);
});
test('sum materials handle alternate values and mandatory cards',()=>{
  const m={type:23,player:0,select_max:0,amount:8,min:1,max:2,selects_must:[{code:1,amount:4}],selects:[{code:2,amount:4},{code:3,amount:3|(4<<16)}]};
  assert.ok(selectionValid(m,[0]));assert.ok(selectionValid(m,[1]));assert.ok(!selectionValid(m,[]));
  const p=describePrompt(m);assert.deepEqual(selectionResponse(m,p,[1]),{type:14,indicies:[0,2]});
});
