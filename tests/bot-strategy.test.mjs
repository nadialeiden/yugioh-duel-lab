import assert from 'node:assert/strict';
import test from 'node:test';
import {chooseBot} from '../dist/bot.mjs';

const [martha, ash, pax, mikailis, griffoh] = [37343995, 14558127, 77913594, 42741437, 40543231];
const cards = new Map([
  [martha, {name:'Exosister Martha',type:33,attack:1600}],
  [ash, {name:'Ash Blossom & Joyous Spring',type:4129,attack:0}],
  [pax, {name:'Exosister Pax',type:65538,attack:0}],
  [mikailis, {name:'Exosister Mikailis',type:8388641,attack:2500}],
  [griffoh, {name:'Griffoh',type:33,strings:['','The next battle or effect damage you take becomes 0','Set 1 card that mentions "Light and Darkness Ritual"']}],
]);

function choose(prompt, {hand = [], chain = [], phase = 'Main 1', turnPlayer = 0} = {}) {
  const player = {monsters:[],spells:[],hand:[],grave:[]};
  const state = {turn:1,turnPlayer,phase,chain,lp:[8000,8000],players:[{...player,hand},player]};
  return chooseBot({...prompt,player:0}, {view:()=>state,botObservations:{}}, cards);
}

test('Standard uses Martha’s hand effect instead of spending its Normal Summon', () => {
  const starter = {code:martha,controller:0,location:2,sequence:0};
  const handTrap = {code:ash,controller:0,location:2,sequence:1};
  const choice = choose({type:11,summons:[starter,handTrap],activates:[starter],to_ep:true}, {hand:[starter,handTrap]});
  assert.deepEqual(choice, {type:1,action:5,index:0});
});

test('Standard searches with Mikailis even on an empty opposing field', () => {
  const search = {code:mikailis,controller:0,location:4,sequence:0,description:(BigInt(mikailis)<<20n)|1n};
  assert.deepEqual(choose({type:11,activates:[search],to_ep:true}), {type:1,action:5,index:0});
});

test('Standard saves Ash for opposing effects', () => {
  const prompt = {type:16,selects:[{code:ash,controller:0,location:2}]};
  assert.deepEqual(choose(prompt,{chain:[{player:0,code:pax}]}), {type:8,index:null});
  assert.deepEqual(choose(prompt,{chain:[{player:1,code:pax}],turnPlayer:1}), {type:8,index:0});
});

test('Standard uses Griffoh to set its Ritual support during Main Phase', () => {
  const id = BigInt(griffoh)<<20n;
  const prompt = {type:14,options:[id|1n,id|2n]};
  assert.deepEqual(choose(prompt), {type:4,index:1});
  assert.deepEqual(choose(prompt,{phase:'Battle'}), {type:4,index:0});
});
