import test from 'node:test';
import assert from 'node:assert/strict';
import {recordChainEvent,ChainPlayback} from '../dist/chain-events.mjs';

function resolvedChain(){
  const state={duelId:'duel-a',chain:[],chainEvents:[],chainEventId:0};
  for(const message of [
    {type:70,code:100,controller:0,chain_size:1,description:1600n},
    {type:70,code:200,controller:1,chain_size:2,description:3200n},
    {type:72,chain_size:2},{type:73,chain_size:2},
    {type:76,chain_size:1},
    {type:72,chain_size:1},{type:73,chain_size:1},{type:74}
  ])recordChainEvent(state,message);
  return state;
}
test('opponent response survives build, negation, reverse resolution and end in one engine batch',()=>{
  const state=resolvedChain();
  assert.deepEqual(state.chain,[]);
  assert.equal(state.chainEvents[1].links[1].player,1);
  assert.deepEqual(state.chainEvents.filter(e=>e.kind==='resolve').map(e=>e.number),[2,1]);
  assert.equal(state.chainEvents.at(-1).links[0].status,'negated');
  assert.equal(state.chainEvents.at(-1).links[1].status,'resolved');
  assert.equal(state.chainEvents[0].links.length,1,'Historical frame must not mutate when Link 2 is added.');
  assert.equal(state.chainEvents[0].links[0].status,'activated');
});
test('playback shows every preserved event once and retains the final chain for review',async()=>{
  const frames=[],busy=[];
  const playback=new ChainPlayback({render:(event,viewer,playing)=>{if(event)frames.push([event.id,viewer,playing]);},onBusyChange:value=>busy.push(value),timings:{activate:0,resolve:0,resolved:0,negated:0,end:0}});
  const state=resolvedChain();playback.update(state,1);
  assert.equal(playback.busy,true);await playback.whenIdle();
  assert.deepEqual(frames.filter(f=>f[2]).map(f=>f[0]),state.chainEvents.map(e=>e.id));
  assert.ok(frames.every(f=>f[1]===1));
  const count=frames.filter(f=>f[2]).length;playback.update(state,1);
  assert.equal(frames.filter(f=>f[2]).length,count,'A repeated multiplayer snapshot must not replay the same events.');
  assert.equal(playback.last.kind,'end');assert.equal(busy.at(-1),false);
});
test('Skip finishes immediately and a new duel resets event deduplication',async()=>{
  const playback=new ChainPlayback({render:()=>{},timings:{activate:5000}});
  const state=resolvedChain();playback.update(state,0);playback.skip();await playback.whenIdle();
  assert.equal(playback.last.kind,'end');
  playback.update({...state,duelId:'duel-b'},0);assert.equal(playback.busy,true);
  playback.reset();assert.equal(playback.busy,false);assert.equal(playback.last,null);
});
test('reset releases the ended duel without disrupting the next duel’s animation controls',{timeout:1000},async()=>{
  const state=resolvedChain();
  const playback=new ChainPlayback({render:()=>{},timings:{activate:5000}});
  playback.update(state,0);
  const oldDuelIdle=playback.whenIdle();
  playback.reset();
  playback.update({...state,duelId:'duel-b'},1);
  await oldDuelIdle;
  assert.equal(playback.busy,true);
  playback.skip();
  await playback.whenIdle();
  assert.equal(playback.last.kind,'end');
});
