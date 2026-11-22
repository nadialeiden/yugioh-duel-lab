import {$,escape,image,art,modal,typeName} from './ui.mjs';
import {cards,cardName,effectText} from './data.mjs';
import {describePrompt,selectionResponse,selectionValid} from './choices.mjs';
import {coachHint} from './evaluation.mjs';
import {chainPlayback} from './chain-ui.mjs';
let onRespond,onInspect,selection=[],counterValues=[],currentPrompt,currentMessage,currentState,currentViewer=0;
const needsPlayConfirmation = (message, choice) => message.type === 11 && !!choice?.card && !!choice.response;
export function configureDuelRenderer({respond,inspect}){onRespond=respond;onInspect=inspect;}
export function gameCard(c,controller,location,sequence,playable=false){
  if(!c)return '';
  const known=!!c.code,defense=location===4&&!!(c.position&12),materials=c.overlayCards?.length||0,set=(location===4||location===8)&&!(c.position&5);
  return `<button class="game-card${defense?' defense':''}${playable?' playable':''}" data-card="${known?c.code:0}" data-controller="${controller}" data-location="${location}" data-sequence="${sequence}" aria-label="${escape(known?(set?'Set: ':'')+cardName(c.code):'Face-down card')}">${known&&!set?image(c.code):'<div class="card-back">◇</div>'}${set?'<span class="stat-badge">SET</span>':location===4&&known?`<span class="stat-badge">${c.position&4?'DEF '+(c.defense??cards.get(c.code)?.defense):'ATK '+(c.attack??cards.get(c.code)?.attack)}</span>`:''}${materials?`<span class="material-badge" title="Xyz materials">${materials}</span>`:''}</button>`;
}
function zone(c,label,controller,location,sequence,playable){return `<div class="zone" data-label="${label}">${gameCard(c,controller,location,sequence,playable)}</div>`;}
function pile(label,count,controller,location,deck=false){return `<button class="pile${deck?' deck-pile':''}" data-pile="${location}" data-controller="${controller}" ${location===1?'disabled':''} aria-label="${label}, ${count} cards"><span>${label}</span><b>${count}</b></button>`;}
export function renderTurnStatus(state,viewer=0){
  const title=$('room-title'),marker=$('turn-marker');
  if(!state?.players?.length){title.removeAttribute('data-turn-owner');return;}
  const finished=state.winner!==null&&state.winner!==undefined;
  const owner=finished?'Duel finished':state.turnPlayer===viewer?'Your turn':'Opponent’s turn';
  if(title.textContent!==owner)title.textContent=owner;title.dataset.turnOwner=finished?'finished':state.turnPlayer===viewer?'you':'opponent';
  title.setAttribute('role','status');title.setAttribute('aria-live','polite');
  marker.innerHTML=`<span class="turn-owner-label">${owner}</span><strong>Turn ${state.turn||'—'}</strong>`;
}
export function renderBoard(state,viewer=0){
  currentState=state;currentViewer=viewer;
  const enemy=viewer^1;
  const playable=new Set();
  if(state?.prompt?.player===viewer)for(const key of ['summons','special_summons','pos_changes','monster_sets','spell_sets','activates','selects','attacks','chains'])for(const c of state.prompt[key]||[])playable.add(c.controller+':'+c.location+':'+c.sequence);
  const players=state?.players?.length===2?state.players:[{monsters:[],spells:[],hand:[],grave:[],banished:[],extra:[],deckCount:40},{monsters:[],spells:[],hand:[],grave:[],banished:[],extra:[],deckCount:40}];
  for(const [prefix,player]of [['own',viewer],['enemy',enemy]]){
    const p=players[player];
    $(prefix+'-monsters').innerHTML=Array.from({length:5},(_,i)=>zone(p.monsters[i],`MONSTER ${i+1}`,player,4,i,playable.has(player+':4:'+i))).join('');
    $(prefix+'-spells').innerHTML=Array.from({length:5},(_,i)=>zone(p.spells[i],i===0?'PENDULUM / S&T':i===4?'S&T / PENDULUM':`SPELL / TRAP ${i+1}`,player,8,i,playable.has(player+':8:'+i))).join('');
    $(prefix+'-spells').classList.add('spell-row');
    $(prefix+'-piles').innerHTML=pile('BANISH',p.banished.length,player,32)+pile('EXTRA',p.extra.length,player,64);
    $(prefix+'-extra-piles').innerHTML=pile('GY',p.grave.length,player,16)+pile('DECK',p.deckCount,player,1,true);
    // Field Spells have their own proper zone, independent of S/T columns.
    $(prefix+'-piles').innerHTML+=`<div class="zone field-spell-zone" data-label="FIELD">${gameCard(p.spells[5],player,8,5,playable.has(player+':8:5'))}</div>`;
  }
  $('opponent-hand').innerHTML=players[enemy].hand.map(()=>'<div class="mini-back" aria-label="Opponent card"></div>').join('');
  $('own-hand').innerHTML=players[viewer].hand.map((c,i)=>gameCard(c,viewer,2,i,playable.has(viewer+':2:'+i))).join('');
  $('hand-count').textContent=players[viewer].hand.length;
  document.querySelector('.hand-label span:last-child').textContent=players[viewer].hand.length>5?'SWIPE / SCROLL TO VIEW ALL CARDS':'SELECT A CARD TO INSPECT';
  $('extra-zones').innerHTML=[5,6].map((sequence,i)=>{
    const c=players[viewer].monsters[sequence]||players[enemy].monsters[i===0?6:5];
    const owner=players[viewer].monsters[sequence]?viewer:enemy,seq=owner===viewer?sequence:i===0?6:5;
    return zone(c,'EXTRA',owner,4,seq,playable.has(owner+':4:'+seq));
  }).join('');
  const phase=state?.phase||'Preparing';
  $('phase-strip').innerHTML=[['Draw','DP'],['Standby','SP'],['Main 1','M1'],['Battle','BP'],['Main 2','M2'],['End','EP']].map(([name,label])=>`<span class="phase-pill${phase===name?' active':''}" title="${name}">${label}</span>`).join('');
  renderTurnStatus(state,viewer);if(!state)$('turn-marker').innerHTML='TURN <strong>—</strong>';
  for(const [suffix,player]of [['you',viewer],['opponent',enemy]]){$('lp-'+suffix).textContent=Number(state?.lp?.[player]??8000).toLocaleString();$('lp-bar-'+suffix).style.width=Math.min(100,(state?.lp?.[player]??8000)/80)+'%';}
  chainPlayback.update(state,viewer);
}
export function inspectCard(id,{popup=false,instance=null,controller,location,sequence,allowActions=false,updateInspector=true}={}){
  const c=cards.get(+id);if(!c)return;
  const content=`<h2>${escape(c.name)}</h2><div class="card-kind">${escape(typeName(c))}${c.level?' · '+(c.type&0x800000?'Rank':c.type&0x4000000?'Link':'Level')+' '+c.level:''}</div>${c.type&1?`<div class="card-stats"><span>ATK <b>${instance?.attack??c.attack}</b></span><span>${c.type&0x4000000?'LINK':'DEF'} <b>${c.type&0x4000000?c.level:instance?.defense??c.defense}</b></span></div>`:''}<p class="card-effect">${escape(c.text)}</p>${instance?.overlayCards?.length?`<p class="mini-label">Xyz materials: ${instance.overlayCards.map(cardName).map(escape).join(', ')}</p>`:''}${c.cid?`<a class="mini-label" href="https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&amp;cid=${c.cid}&amp;request_locale=ae" target="_blank" rel="noreferrer">Official AE card details</a>`:''}`;
  if(updateInspector){$('inspect-art').classList.remove('card-back');$('inspect-art').innerHTML=image(id);$('inspect-details').innerHTML=content;}
  if(popup||innerWidth<=1050){
    const available=allowActions&&currentState?.prompt?.player===currentViewer&&!chainPlayback.busy?describePrompt(currentState.prompt,cardName,effectText).choices.map((choice,index)=>({...choice,index})).filter(choice=>choice.response&&choice.card?.code===+id&&(controller===undefined||choice.card.controller===controller&&choice.card.location===location&&choice.card.sequence===sequence)):[];
    modal(c.name,`<div class="modal-card"><div>${image(id)}</div><div>${content}</div></div>${available.length?`<div class="inspector-actions"><h3>Available actions</h3>${available.map(choice=>`<button class="action-choice" data-choice="${choice.index}"><span><strong>${escape(choice.label)}</strong><small>${escape(choice.detail)}</small></span></button>`).join('')}</div>`:''}`);
  }
}
export function openPile(controller,location){
  const p=currentState?.players[controller];if(!p)return;
  const key={16:'grave',32:'banished',64:'extra'}[location];if(!key)return;
  if(key==='extra'&&controller!==currentViewer){modal('Opponent’s Extra Deck',`<p>${p.extra.length} cards. Face-down Extra Deck contents are private.</p>`);return;}
  modal((controller===currentViewer?'Your ':'Opponent’s ')+{16:'Graveyard',32:'banished cards',64:'Extra Deck'}[location],p[key].length?`<div class="zone-modal-grid">${p[key].map((c,i)=>gameCard(c,controller,location,i)).join('')}</div>`:'<p>This zone is empty.</p>');
}
export function renderDecision(state,viewer,{coach=true,thinking=false,ended=false,takeover=false}={}){
  const panel=$('decision-panel'),m=state?.prompt;
  document.body.classList.toggle('duel-live',!!state?.players?.length);
  const mobileStatus=$('mobile-decision-status');if(mobileStatus)mobileStatus.textContent=(state.winner!==null&&state.winner!==undefined?'Duel finished':state.turnPlayer===viewer?'Your turn':'Opponent’s turn')+(chainPlayback.busy?' · Chain':m?.player===viewer?' · Choose':'');
  if(ended||state?.winner!==null&&state?.winner!==undefined){panel.innerHTML=`<div class="waiting-icon">◇</div><h2>${state?.winner===viewer?'Your victory.':state?.winner===2?'A draw.':'A chance to learn.'}</h2><p class="muted">${ended?'The duel has ended.':'The result is recorded by the OCG engine.'}</p><button class="primary full" data-action="review">Open practice review</button>`;return;}
  if(!m||m.player!==viewer&&!takeover){panel.innerHTML=`<span class="tiny-label">${thinking?'AI OPPONENT':'LOCAL DUEL'}</span><div class="waiting-icon">◇</div><h2>${thinking?'Considering its next play…':'Waiting for your opponent.'}</h2><p class="muted">You will receive a decision when you have a legal play or response.</p>`;return;}
  currentMessage=m;currentPrompt=describePrompt(m,cardName,effectText);selection=[];counterValues=Array(m.cards?.length||0).fill(0);
  const confirmPlay = currentPrompt.choices.some(choice => needsPlayConfirmation(m, choice));
  currentPrompt.confirmPlay = confirmPlay;
  const summary = '<div class="selection-count" id="selection-count" role="status"></div>';
  const footer = confirmPlay || currentPrompt.multiple || currentPrompt.counter
    ? `<div class="selection-footer">${confirmPlay ? summary : ''}<button id="confirm-selection" class="primary" disabled>${confirmPlay ? 'Confirm play' : 'Confirm selection'}</button>${currentPrompt.cancel ? '<button id="cancel-selection" class="subtle">Cancel</button>' : ''}</div>`
    : '';
  panel.innerHTML=`${takeover?'<div class="status-banner">AI needs assistance with this decision. Your choice will be played for the opponent.</div>':''}<span class="tiny-label">${state.turnPlayer===viewer?'YOUR TURN':'RESPONSE WINDOW'}</span><h2 style="margin-top:.6rem">${escape(currentPrompt.title)}</h2>${coach?`<details class="prompt-help" ${innerWidth>780?'open':''}><summary>Timing help</summary><p>${escape(coachHint(m,state.phase,cardName))}</p></details>`:''}${currentPrompt.note?`<p class="muted">${escape(currentPrompt.note)}</p>`:''}${currentPrompt.multiple ? summary : ''}<div id="decision-choices">${currentPrompt.choices.map((choice,index)=>`<button class="action-choice" data-choice="${index}">${choice.card?.code?image(choice.card.code):''}<span><strong>${escape(choice.label)}</strong>${choice.card?.code&&choice.label!==cardName(choice.card.code)?`<small>${escape(cardName(choice.card.code))}</small>`:''}${choice.detail?`<small>${escape(choice.detail)}</small>`:''}</span></button>`).join('')}</div>${currentPrompt.counter?m.cards.map((c,i)=>`<label class="counter-control"><span>${escape(cardName(c.code))}</span><input type="number" data-counter="${i}" min="0" max="${c.count}" value="0"></label>`).join(''):''}${currentPrompt.announce?'<input id="declare-card" type="search" placeholder="Search a card to declare"><div id="declare-results"></div>':''}${footer}`;
  if(currentPrompt.multiple || confirmPlay){
    const clear=document.createElement('button');clear.id='clear-selection';clear.className='subtle';clear.textContent='Clear selection';
    $('confirm-selection').after(clear);updateSelectionDisplay();
  }
  document.querySelectorAll('#decision-choices [data-choice]').forEach(button=>{
    const index=+button.dataset.choice,choice=currentPrompt.choices[index];
    if(!choice.card?.code||!cards.has(choice.card.code))return;
    const row=document.createElement('div');row.className='decision-option';button.before(row);row.append(button);
    const read=document.createElement('button');read.className='read-choice';read.dataset.readChoice=String(index);read.textContent='Read card';read.setAttribute('aria-label','Read '+cardName(choice.card.code));row.append(read);
  });
  if(currentPrompt.announce)import('./vendor/ocg/index.js').then(({cardMatchesOpcode})=>{
    $('declare-card').oninput=()=>{const query=$('declare-card').value.toLowerCase();if(query.length<2){$('declare-results').innerHTML='';return;}
      const matches=[...cards.values()].filter(c=>c.name.toLowerCase().includes(query)&&cardMatchesOpcode({...c,race:BigInt(c.race)},m.opcodes)).slice(0,20);
      $('declare-results').innerHTML=matches.map(c=>`<button class="action-choice" data-declare="${c.code}">${escape(c.name)}</button>`).join('');};
  });
}
export function previewChoice(index){const code=currentPrompt?.choices[index]?.card?.code;if(code&&cards.has(code))inspectCard(code,{popup:true});}
export function handleChoice(index){
  const p=currentPrompt,m=currentMessage,choice=p.choices[index];if(!choice)return;
  if(choice.card?.code&&innerWidth>1050)inspectCard(choice.card.code);
  if(p.multiple || needsPlayConfirmation(m, choice)){
    if(selection.includes(index))selection=selection.filter(i=>i!==index);
    else if(p.max===1)selection=[index];
    else if(selection.length<p.max)selection.push(index);
    updateSelectionDisplay();return;
  }
  if(choice.response)onRespond(choice.response);
}
function updateSelectionDisplay(){
  const p=currentPrompt;
  document.querySelectorAll('#decision-choices [data-choice]').forEach(button => {
    const index = +button.dataset.choice;
    if (!p.multiple && !needsPlayConfirmation(currentMessage, p.choices[index])) return;
    const selected = selection.includes(index);
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (p.confirmPlay) {
    const choice = p.choices[selection[0]];
    $('selection-count').textContent = choice
      ? [choice.label, cardName(choice.card.code), choice.detail].filter((part, i, parts) => part && parts.indexOf(part) === i).join(' · ')
      : 'Select a play. You can change it before confirming.';
  } else {
    $('selection-count').textContent=selection.length+' / '+p.max+' selected'+(p.ordered?' · order '+selection.map(i=>i+1).join(', '):p.max===1&&selection.length?' · '+p.choices[selection[0]].label:selection.length===p.max?' · Tap a selected choice to remove it':'');
  }
  $('confirm-selection').disabled = p.confirmPlay ? selection.length !== 1 : !selectionValid(currentMessage, selection);
  $('clear-selection').disabled=selection.length===0;
}
export function clearSelection(){if(!currentPrompt?.multiple&&!currentPrompt?.confirmPlay)return;selection=[];updateSelectionDisplay();}
export function confirmSelection(){
  if (currentPrompt.confirmPlay) {
    const choice = currentPrompt.choices[selection[0]];
    if (needsPlayConfirmation(currentMessage, choice)) onRespond(choice.response);
    return;
  }
  if(currentPrompt.counter){if(counterValues.reduce((a,b)=>a+b,0)!==currentMessage.count)return;}else if(!selectionValid(currentMessage,selection))return;
  onRespond(selectionResponse(currentMessage,currentPrompt,selection,counterValues));
}
export function changeCounter(index,value){const maximum=currentMessage.cards[index].count;counterValues[index]=Math.min(maximum,Math.max(0,Math.floor(+value||0)));$('confirm-selection').disabled=counterValues.reduce((a,b)=>a+b,0)!==currentMessage.count;}
export function cancelSelection(){if(currentPrompt.cancel)onRespond(currentPrompt.cancel);}
export function renderLog(state){$('log-panel').innerHTML=state?.log?.length?state.log.slice().reverse().map(row=>`<div class="duel-log"><time>TURN ${row.turn||'SETUP'}</time>${escape(row.text)}</div>`).join(''):'<p class="muted">Summons, chains, and battle results will appear here.</p>';}
export function renderReview(review,state){
  if(!review){$('evaluation-panel').innerHTML='<h2>Practice evaluations</h2><p class="muted">Play against the AI opponent to track your decisions, response windows, and board resources. Local duels do not collect a practice evaluation.</p>';return;}
  const s=review.summary(state);
  $('evaluation-panel').innerHTML=`<span class="tiny-label">YOUR PRACTICE REVIEW</span><h2 style="margin-top:.6rem">Reflect on your line.</h2><p class="muted">Measured decisions and resource counts. These are coaching indicators, not an optimal-play score.</p><div class="review-metrics"><div class="metric"><strong>${s.summons}</strong><span>Summon commands</span></div><div class="metric"><strong>${s.activations}</strong><span>Effects chosen</span></div><div class="metric"><strong>${s.responsesUsed}/${s.responsesOffered}</strong><span>Responses taken</span></div><div class="metric"><strong>${s.hand} / ${s.board}</strong><span>Hand / field cards</span></div></div><div class="review-note"><strong>Current resources</strong>${s.lp.toLocaleString()} LP · Turn ${s.turns}. More responses used does not necessarily mean better play; timing and card economy matter.</div>${s.notes.length?s.notes.slice(-8).map(n=>`<div class="review-note"><strong>Turn ${n.turn} · ${escape(n.title)}</strong>${escape(n.text)}</div>`).join(''):'<div class="review-note"><strong>A useful question for your next duel</strong>What did your opening hand need to accomplish, and which interruption would have stopped that plan?</div>'}<div class="review-actions"><button class="subtle" data-action="export-review">Export review</button><button class="subtle" data-action="export-log">Export duel log</button></div>`;
}
