import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync,strFromU8} from 'fflate';
import {DuelSession} from '../dist/engine.mjs';
import {chooseBot} from '../dist/bot.mjs';
import {OcgCoreInternal} from '../dist/vendor/ocg/index.js';
const cards=new Map(JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url),'utf8')).map(c=>[c.code,c]));
const decks=JSON.parse(fs.readFileSync(new URL('../dist/data/starters.json',import.meta.url),'utf8')).decks;
const scripts=new Map(Object.entries(JSON.parse(strFromU8(gunzipSync(fs.readFileSync(new URL('../dist/data/effects.bin',import.meta.url)))))));
const errors=[];
const session=new DuelSession({cards,readScript:name=>scripts.get(name)||scripts.get('official/'+name)||null,onError:e=>{errors.push(e);console.error(e.stack);},seed:[1n,2n,3n,4n]});
await session.start(decks.slice(0,2));
console.log('Opening',session.state.turn,session.state.phase,'prompt',session.state.prompt?.type,'hands',session.state.players.map(p=>p.hand.length));
assert.deepEqual(session.state.players.map(p=>p.hand.length),[5,5]);
assert.equal(session.state.prompt.to_bp,false,'Starting player must not enter Battle Phase on turn one.');
if(process.env.DEBUG_DUEL)console.log(JSON.stringify(session.state.players[0],(_,v)=>typeof v==='bigint'?String(v):v));
if(process.env.RAW_QUERY){
 const mod=session.core[OcgCoreInternal].module,save=mod.stackSave(),ptr=mod.stackAlloc(24),out=mod.stackAlloc(4),dv=new DataView(mod.HEAPU8.buffer);
 dv.setUint32(ptr,1|2|8|16|256|512,true);dv.setUint8(ptr+4,0);dv.setUint32(ptr+8,2,true);dv.setUint32(ptr+12,0,true);dv.setUint32(ptr+16,0,true);
 const handle=session.handle[Object.getOwnPropertySymbols(session.handle)[0]].handle;
 const q=mod._ocgapiDuelQueryLocation(handle,out,ptr),len=dv.getUint32(out,true);
 console.log('RAW',len,Buffer.from(mod.HEAPU8.slice(q,q+Math.min(len,220))).toString('hex'));mod.stackRestore(save);process.exit();
}
for(let i=0;i<3500&&!session.closed&&!errors.length&&session.state.turn<=25;i++) {
  const m=session.state.prompt;if(!m)throw new Error('No decision');
  const response=chooseBot(m,session,cards);
  if(!response)throw new Error('No bot response '+m.type);
  if(process.env.DEBUG_DUEL)console.log(i,'P'+m.player,m.type,JSON.stringify(response,(_,v)=>typeof v==='bigint'?String(v):v));
  session.respond(response);
}
console.log('Result',session.state.turn,session.state.phase,session.state.lp,'errors',errors.length,'responses',session.history.length);
console.log(session.state.log.slice(-18).map(l=>l.text).join('\n'));
const finished=session.closed;
session.destroy();
assert.ok(finished&&[0,1].includes(session.state.winner),'The seeded real-core duel should finish with a winner.');
if(errors.length)process.exitCode=1;
