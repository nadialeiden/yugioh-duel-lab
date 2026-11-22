export class PracticeReview {
  constructor(player,cards,difficulty='standard'){this.player=player;this.cards=cards;this.difficulty=difficulty;this.decisions=[];this.started=Date.now();this.startTurn=0;this.notes=[];this.previousKey='';}
  record(message,response,state){
    const key=state.promptId;if(key===this.previousKey)return;this.previousKey=key;
    if(message.player!==this.player)return;
    const row={turn:state.turn,phase:state.phase,type:message.type,response,time:Date.now()};
    if(message.type===11){
      row.action=['Normal Summon','Special Summon','Change position','Set monster','Set Spell / Trap','Activate effect','Battle Phase','End Phase'][response.action];
      const lists=[message.summons,message.special_summons,message.pos_changes,message.monster_sets,message.spell_sets,message.activates];
      row.code=lists[response.action]?.[response.index]?.code;
      if(response.action===7&&message.summons?.length&&!this.decisions.some(d=>d.turn===state.turn&&d.action==='Normal Summon'))this.notes.push({turn:state.turn,title:'An unused Normal Summon',text:'You ended this turn with a legal Normal Summon available. This can be intentional. Check whether an additional body would have improved your line.'});
      if(response.action===0&&this.cards.get(row.code)?.name?.startsWith('Exosister')&&message.special_summons.some(c=>this.cards.get(c.code)?.name==='Exosister Martha'))this.notes.push({turn:state.turn,title:'Check your Martha sequencing',text:'Martha was available before this Normal Summon. Compare starting with Martha to see which line keeps more options open; your opening hand determines the better route.'});
    }
    if(message.type===16&&message.selects.length){row.responseOffered=true;row.responseUsed=response.index!==null;row.action=row.responseUsed?'Chain response':'Passed response';}
    if(message.type===12)row.action=response.yes?'Accepted optional effect':'Declined optional effect';
    this.decisions.push(row);
  }
  summary(state){
    const mine=state.players[this.player];
    const responses=this.decisions.filter(d=>d.responseOffered);
    return {difficulty:this.difficulty,elapsed:Math.round((Date.now()-this.started)/60000),turns:state.turn,
      summons:this.decisions.filter(d=>['Normal Summon','Special Summon'].includes(d.action)).length,
      activations:this.decisions.filter(d=>d.action==='Activate effect'||d.action==='Accepted optional effect').length,
      responsesUsed:responses.filter(d=>d.responseUsed).length,responsesOffered:responses.length,
      hand:mine?.hand.length||0,board:(mine?.monsters.filter(Boolean).length||0)+(mine?.spells.filter(Boolean).length||0),lp:state.lp[this.player],notes:this.notes,
      decisions:this.decisions};
  }
}
export function coachHint(m,phase,name){
  if(m.type===16)return m.forced?'A mandatory trigger must enter the chain. Choose its order carefully if several effects are eligible.':'The engine has opened a response window. Select a legal effect or Pass response. Chains resolve from the newest link back to Chain Link 1.';
  if(m.type===12)return 'This is an optional effect. Read the effect and its cost before choosing Yes. The engine handles once-per-turn restrictions.';
  if(m.type===15)return 'Only cards eligible for this effect appear here. Select the required number, then Confirm selection. Selecting a target and paying a cost happen at different points.';
  if(m.type===23||m.type===26)return 'Select materials, then finish when the engine permits it. The engine checks levels, ranks, Link arrows, and summoning restrictions.';
  if(m.type===18)return 'Choose an available zone. Fusion, Synchro, and Xyz monsters can use Main Monster Zones. Links and face-up Pendulums from the Extra Deck need the appropriate zone.';
  if(m.type===10)return 'Choose a monster to attack with. The engine asks for a target next and opens legal response windows before calculating battle damage.';
  if(m.type===11&&phase==='Main 1')return 'Highlighted cards have legal actions. In Decision, pick a card action and use Confirm play when you are ready. You can enter the Battle Phase when the engine offers it.';
  if(m.type===20)return 'Tributing uses the listed monsters. The highlighted selection must satisfy the required Tribute count.';
  return 'Read the current decision, select a legal option, and confirm. Card costs and effect timing are enforced by the duel engine.';
}
