import {R,describePrompt,selectionResponse,selectionValid} from './choices.mjs';
import {cardMatchesOpcode} from './vendor/ocg/index.js';
import {mainAction,chainValue,targetValue,optionValue,planBattle} from './bot-strategy.mjs';
const priorities = new Map([
  ['Exosister Martha',100],['Exosister Pax',98],['Exosister Elis',90],['Exosister Stella',85],['Sakitama',95],['Aratama',80],
  ['Exosister Kaspitell',95],['Exosister Mikailis',97],['Exosisters Magnifica',110],['Exosister Vadis',80],['Exosister Returnia',95],
  ['Swordsoul of Mo Ye',100],['Swordsoul of Taia',90],['Swordsoul Strategist Longyuan',95],['Swordsoul Emergence',100],
  ['Swordsoul Grandmaster - Chixiao',105],['Swordsoul Supreme Sovereign - Chengying',100],['Tenyi Spirit - Ashuna',90],['Tenyi Spirit - Vishuda',80],
  ['Rescue-ACE Hydrant',110],['Rescue-ACE Air Lifter',100],['Rescue-ACE Quick Attacker',105],['Rescue-ACE Turbulence',110],['Rescue-ACE Preventer',95],['Rescue-ACE Arbitrator',120],['EMERGENCY!',112],
  ['Salamangreat of Fire',110],['Salamangreat Gazelle',105],['Salamangreat Spinny',95],['Salamangreat Circle',110],['Cynet Mining',105],['Salamangreat Sunlight Wolf',105],['Salamangreat Raging Phoenix',115],['Salamangreat Miragestallio',108],
  ['Sage with Eyes of Blue',105],['Maiden of White',110],['Wishes for Eyes of Blue',115],['Roar of the Blue-Eyed Dragons',110],['Spirit with Eyes of Blue',110],['Blue-Eyes Spirit Dragon',110],['Blue-Eyes Ultimate Spirit Dragon',125],['True Light',100],
  ['Arianna the Labrynth Servant',110],['Arias the Labrynth Butler',100],['Lady Labrynth of the Silver Castle',105],['Lovely Labrynth of the Silver Castle',100],['Big Welcome Labrynth',115],['Welcome Labrynth',105],
  ['Ash Blossom & Joyous Spring',90],['Maxx "C"',100],['Infinite Impermanence',95],['Called by the Grave',100]
]);
export function chooseBot(m,session,cardMap,difficulty='standard') {
  const prompt=describePrompt(m,id=>cardMap.get(id)?.name||String(id));
  const me=m.player, state=session.view(me), enemy=state.players[me^1], own=state.players[me];
  const card=id=>cardMap.get(id);
  const score=c=>{const data=card(c?.code);return (priorities.get(data?.name)||50)+(data?.attack||0)/200;};
  const best=choices=>choices.reduce((a,b)=>b.score>a.score?b:a);
  const effectName=card(session.lastActivation?.code)?.name||'';
  const observations=session.botObservations;
  const context={own,enemy,state,player:me,cards:cardMap,prompt:m,observations,hint:observations?.hint,effect:effectName};
  const expert=difficulty==='expert', beginner=difficulty==='beginner';
  if(m.type===11) {
    const uses=session.botUses||(session.botUses=new Map());
    const activationKey=choice=>state.turn+':'+m.player+':'+choice.card?.code+':'+choice.card?.location+':'+String(choice.card?.description||0);
    const scored=prompt.choices.map(choice=>{
      const r=choice.response, c=card(choice.card?.code); let value=-20;
      if(r.action===0)value=score(choice.card)+30;
      if(r.action===1)value=score(choice.card)+50;
      if(r.action===5) {
        if((uses.get(activationKey(choice))||0)>=2)return {choice,score:-100};
        value=score(choice.card)+60;
        if(c?.type&(4|65536))value=-20;
      }
      if(r.action===4)value=30;
      if(r.action===3)value=0;
      if(r.action===2)value=-25;
      if(r.action===6)value=10;
      if(r.action===7)value=-10;
      return {choice,score:mainAction(choice,context,value,difficulty)};
    });
    const choice=best(scored).choice;
    if (observations) observations.mainChoice={player:me,code:choice.card?.code,action:choice.response.action};
    if(choice.response.action===5){const key=activationKey(choice);uses.set(key,(uses.get(key)||0)+1);}
    return choice.response;
  }
  if(m.type===10) {
    const plan=planBattle(prompt.choices,context,expert?4:beginner?1:2);
    if(plan.attacker){
      if(observations)observations.battleChoice={player:me,target:plan.target};
      return plan.attacker.choice.response;
    }
    return prompt.choices.find(c=>c.response.action===2)?.response||prompt.choices.find(c=>c.response.action===3)?.response||prompt.choices[0].response;
  }
  if(m.type===16) {
    const candidates=prompt.choices.filter(choice=>choice.card).map(choice=>{
      const value=chainValue(choice,context,difficulty);
      const adjustment=beginner&&/Ash Blossom|Veiler|Impermanence|Maxx|Called by|Nibiru|Ogre|Crossout|Shifter|^Dominus/.test(card(choice.card.code)?.name||'')?40:0;
      return {choice,score:value-adjustment};
    });
    const chosen=candidates.length?best(candidates):null;
    return chosen&&(m.forced||chosen.score>=(expert?42:48))?chosen.choice.response:{type:8,index:null};
  }
  if(m.type===13 && Number(m.description)===31 && observations?.battleChoice?.player===me){
    return {type:R.YESNO,yes:observations.battleChoice.target===null};
  }
  if(m.type===12||m.type===13)return prompt.choices[0].response;
  if(m.type===26) {
    if(m.can_finish)return {type:7,index:null};
    if(m.select_cards.length)return {type:7,index:best(m.select_cards.map((c,index)=>({index,score:-score(c)+targetValue(c,context,difficulty)}))).index};
    return {type:7,index:null};
  }
  if(m.type===19) {
    const monster=card(m.code);
    const defend=state.turnPlayer!==me && monster?.defense>monster.attack
      || monster?.attack===0 && monster.defense>0;
    return prompt.choices.find(c=>c.response.position===(defend?4:1))?.response || prompt.choices[0].response;
  }
  if(prompt.counter) {
    let remaining=m.count; const counters=m.cards.map(c=>{const n=Math.min(c.count,remaining);remaining-=n;return n;}); return {type:13,counters};
  }
  if(prompt.multiple) {
    if(prompt.place) {
      const center = prompt.choices.findIndex(choice => choice.card.player === me && choice.card.location === 4 && choice.card.sequence === 2);
      const action = observations?.mainChoice;
      const centerSummon = action?.player === me && action.action === 0 && card(action.code)?.name === 'Elfnote Regina';
      const middleSpell = prompt.choices.findIndex(choice => choice.card.player === me && choice.card.location === 8 && choice.card.sequence >= 1 && choice.card.sequence <= 3);
      const preferred = centerSummon && center >= 0 ? center : middleSpell;
      const selected = m.type === 18 && m.count === 1 && preferred >= 0 ? [preferred] : Array.from({length:m.count},(_,i)=>i);
      return selectionResponse(m,prompt,selected);
    }
    if(prompt.ordered)return selectionResponse(m,prompt,prompt.choices.map((_,i)=>i));
    if(m.type===140||m.type===141)return selectionResponse(m,prompt,Array.from({length:m.count},(_,i)=>i));
    const order=prompt.choices.map((choice,index)=>{
      const c=choice.card; let value=score(c);
      if(c.controller!==me){value+=150;if(!c.code)value=60;}
      if(c.controller===me&&c.location===4)value=-value;
      if(/Chixiao|Longyuan/.test(effectName)&&c.controller===me&&c.location===2)value=-score(c);
      if(/Kaspitell|Pax/.test(effectName)&&c.location===1)value=score(c);
      if(c.controller===me&&(context.hint===501||context.hint===519))value=-score(c);
      value+=targetValue(c,context,difficulty);
      return {index,score:value};
    }).sort((a,b)=>b.score-a.score).map(c=>c.index);
    // A bounded subset search handles alternative Synchro/ritual material values.
    const max=Math.min(prompt.max,order.length),min=m.type===20?0:prompt.min;
    let found=null,nodes=0;
    const single = m.type===23 && min <= 1 && max >= 1 ? order.find(index=>selectionValid(m,[index])) : undefined;
    if (m.type===23 && single!==undefined && !selectionValid(m,[])) return selectionResponse(m,prompt,[single]);
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
    if(effectName==='Crossout Designator') {
      const opponent=state.chain.findLast(link=>link.player!==me);
      if(legal.some(c=>c.code===opponent?.code))return {type:R.ANNOUNCE,card:opponent.code};
    }
    legal.sort((a,b)=>score(b)-score(a));return {type:18,card:legal[0].code};
  }
  if(m.type===14)return best(prompt.choices.map((choice,index)=>({choice,score:optionValue(m.options[index],context)}))).choice.response;
  return prompt.choices[0]?.response;
}
