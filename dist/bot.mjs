import {describePrompt,selectionResponse,selectionValid} from './choices.mjs';
import {cardMatchesOpcode} from './vendor/ocg/index.js';
const priorities = new Map([
  ['Exosister Martha',100],['Exosister Pax',98],['Exosister Elis',90],['Exosister Stella',85],['Sakitama',95],['Aratama',80],
  ['Exosister Kaspitell',95],['Exosister Mikailis',97],['Exosisters Magnifica',110],['Exosister Vadis',80],['Exosister Returnia',95],
  ['Swordsoul of Mo Ye',100],['Swordsoul of Taia',90],['Swordsoul Strategist Longyuan',95],['Swordsoul Emergence',100],
  ['Swordsoul Grandmaster - Chixiao',105],['Swordsoul Supreme Sovereign - Chengying',100],['Tenyi Spirit - Ashuna',90],['Tenyi Spirit - Vishuda',80],
  ['Ash Blossom & Joyous Spring',90],['Maxx "C"',100],['Infinite Impermanence',95],['Called by the Grave',100]
]);
export function chooseBot(m,session,cardMap) {
  const prompt=describePrompt(m,id=>cardMap.get(id)?.name||String(id));
  const me=m.player, state=session.view(me), enemy=state.players[me^1], own=state.players[me];
  const enemyMonsters=enemy.monsters.filter(Boolean), ownMonsters=own.monsters.filter(Boolean);
  const card=id=>cardMap.get(id);
  const score=c=>{const data=card(c?.code);return (priorities.get(data?.name)||50)+(data?.attack||0)/200;};
  const best=choices=>choices.reduce((a,b)=>b.score>a.score?b:a);
  const effectName=card(session.lastActivation?.code)?.name||'';
  if(m.type===11) {
    const scored=prompt.choices.map(choice=>{
      const r=choice.response, c=card(choice.card?.code); let value=-20;
      if(r.action===0)value=score(choice.card)+30;
      if(r.action===1)value=score(choice.card)+50;
      if(r.action===5) {
        value=score(choice.card)+60;
        if((c?.type&4)||(c?.type&65536))value=state.turnPlayer===me?-30:value;
        if(/Reborn|Vishuda|Raigeki|Lightning Storm/.test(c?.name||'')&&!enemyMonsters.length)value=-50;
        if(/Returnia|Mikailis/.test(c?.name||'')&&choice.card.location===4&&!enemyMonsters.length&&!enemy.grave.length)value=-40;
      }
      if(r.action===4)value=30;
      if(r.action===3)value=0;
      if(r.action===2)value=-25;
      if(r.action===6)value=10;
      if(r.action===7)value=-10;
      return {choice,score:value};
    });
    return best(scored).choice.response;
  }
  if(m.type===10) {
    const attacks=prompt.choices.filter(c=>c.response.action===1).map(choice=>{
      const atk=own.monsters[choice.card.sequence]?.attack??card(choice.card.code)?.attack??0;
      const killable=enemyMonsters.filter(c=>!c.code||atk>=(c.position&4?c.defense:c.attack));
      return {choice,score:choice.card.can_direct?1000+atk:killable.length?atk:-10000};
    });
    if(attacks.length&&best(attacks).score>-10000)return best(attacks).choice.response;
    return prompt.choices.find(c=>c.response.action===2)?.response||prompt.choices.find(c=>c.response.action===3)?.response||prompt.choices[0].response;
  }
  if(m.type===16) {
    const shouldRespond=m.forced||session.lastActivation?.controller!==(me)||state.turnPlayer!==me;
    if(!shouldRespond)return {type:8,index:null};
    const candidates=prompt.choices.filter(c=>c.card).map(choice=>({choice,score:score(choice.card)}));
    return candidates.length?best(candidates).choice.response:{type:8,index:null};
  }
  if(m.type===12||m.type===13)return prompt.choices[0].response;
  if(m.type===26) {
    if(m.can_finish)return {type:7,index:null};
    if(m.select_cards.length)return {type:7,index:m.select_cards.map((c,index)=>({index,score:score(c)})).sort((a,b)=>a.score-b.score)[0].index};
    return {type:7,index:null};
  }
  if(m.type===19)return prompt.choices.find(c=>c.response.position===1)?.response||prompt.choices[0].response;
  if(prompt.counter) {
    let remaining=m.count; const counters=m.cards.map(c=>{const n=Math.min(c.count,remaining);remaining-=n;return n;}); return {type:13,counters};
  }
  if(prompt.multiple) {
    if(prompt.place)return selectionResponse(m,prompt,Array.from({length:m.count},(_,i)=>i));
    if(prompt.ordered)return selectionResponse(m,prompt,prompt.choices.map((_,i)=>i));
    if(m.type===140||m.type===141)return selectionResponse(m,prompt,Array.from({length:m.count},(_,i)=>i));
    const order=prompt.choices.map((choice,index)=>{
      const c=choice.card; let value=score(c);
      if(c.controller!==me){value+=150;if(!c.code)value=60;}
      if(c.controller===me&&c.location===4)value=-value;
      if(/Chixiao|Longyuan/.test(effectName)&&c.controller===me&&c.location===2)value=-score(c);
      if(/Kaspitell|Pax/.test(effectName)&&c.location===1)value=score(c);
      return {index,score:value};
    }).sort((a,b)=>b.score-a.score).map(c=>c.index);
    // A bounded subset search handles alternative Synchro/ritual material values.
    const max=Math.min(m.max||order.length,order.length),min=m.min||0;
    let found=null,nodes=0;
    const visit=(start,picked)=>{
      if(found||++nodes>100000)return;
      if(picked.length>=min&&selectionValid(m,picked)){found=picked.slice();return;}
      if(picked.length>=max)return;
      for(let j=start;j<order.length;j++){picked.push(order[j]);visit(j+1,picked);picked.pop();if(found)return;}
    };
    visit(0,[]);
    if(found)return selectionResponse(m,prompt,found);
    if(prompt.cancel)return prompt.cancel;
    throw new Error('Computer could not find valid materials.');
  }
  if(prompt.announce){
    const legal=[...cardMap.values()].filter(c=>cardMatchesOpcode({...c,race:BigInt(c.race)},m.opcodes));
    if(!legal.length)throw new Error('No legal card declaration was found.');
    legal.sort((a,b)=>score(b)-score(a));return {type:18,card:legal[0].code};
  }
  if(m.type===14)return prompt.choices[0].response;
  return prompt.choices[0]?.response;
}
