import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync,strFromU8} from 'fflate';
import {DuelSession} from '../dist/engine.mjs';
import {chooseBot} from '../dist/bot.mjs';
const read=name=>fs.readFileSync(new URL('../dist/data/'+name,import.meta.url));
const cards=new Map(JSON.parse(read('catalog.json')).map(c=>[c.code,c]));
const decks=JSON.parse(read('starters.json')).decks;
const scripts=new Map(Object.entries(JSON.parse(strFromU8(gunzipSync(read('effects.bin'))))));
for(const deck of decks){
  const errors=[];const s=new DuelSession({cards,readScript:name=>scripts.get(name)||scripts.get('official/'+name)||null,onError:e=>errors.push(e),seed:[42n,123n,456n,789n]});
  try{
    await s.start([decks[0],deck]);
    for(let i=0;i<1500&&!s.closed&&!errors.length&&s.state.turn<=12;i++){
      const m=s.state.prompt;assert.ok(m,'Engine must offer a decision');
      const response=chooseBot(m,s,cards);assert.ok(response,'AI must produce a response');
      if(process.env.DEBUG_AI)console.log(deck.id,i,'turn',s.state.turn,'P'+m.player,m.type,JSON.stringify(response,(_,v)=>typeof v==='bigint'?String(v):v));
      s.respond(response);
    }
    assert.deepEqual(errors.map(e=>e.message),[],deck.id+' must not produce rejected actions');
    assert.ok(s.closed||s.state.turn>=6,deck.id+' must progress through several turns');
    assert.ok(s.history.length<1500,deck.id+' must not loop');
    console.log(deck.name+' · '+s.history.length+' decisions · turn '+s.state.turn+' · winner '+s.state.winner+' · valid');
  }finally{s.destroy();}
}
