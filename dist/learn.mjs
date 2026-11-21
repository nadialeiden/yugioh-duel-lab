import {$,escape,image,art,modal} from './ui.mjs';
import {cards,cardName} from './data.mjs';
import {inspectCard} from './duel-render.mjs';
let lesson=0,chainStep=0,timer=null,completed=new Set();
const labels=['Find your mode','Inspect a card','Make a play','Read the table','Watch a chain','Bring your own deck'];
const subtitles=['Practice, local, or learn','Text, stats, and materials','Select, choose, confirm','Phases and response windows','Build it. Resolve it.','Import and check AE legality'];
const code=name=>[...cards.values()].find(c=>c.name===name)?.code;
export function renderLearn(){
  clearInterval(timer);timer=null;
  $('lesson-list').innerHTML=labels.map((name,i)=>`<button data-lesson="${i}" class="${i===lesson?'active':''}">${escape(name)}${completed.has(i)?' · Complete':''}<small>${subtitles[i]}</small></button>`).join('');
  $('lesson-progress').textContent='Lesson '+(lesson+1)+' of '+labels.length;
  $('lesson-prev').disabled=lesson===0;$('lesson-next').textContent=lesson===labels.length-1?'Finish tour':'Next lesson';
  const content=$('lesson-content');
  if(lesson===0)content.innerHTML=`<div class="eyebrow">YOUR FIRST VISIT</div><h2>Three ways to use the table.</h2><p>Practice against the AI opponent, play a person on your local network, or explore this tour. The navigation across the top keeps them separate.</p><div class="lesson-mode-cards"><div><strong>Practice</strong><p>Pick your deck and the AI opponent’s deck. Turn helpers on for response guidance, then open Review to evaluate your decisions.</p></div><div><strong>Local duel</strong><p>Open this site on two devices. One person creates a room and shares its six-character code. On a hosted site, the devices connect through WebRTC.</p></div><div><strong>Learn the interface</strong><p>This is a safe demonstration. It does not start a match, change your saved decks, or change a live duel.</p></div></div><div class="lesson-tip">Deck workshop is shared by both duel modes. Save a deck there, then select it when setting up your next game.</div>`;
  if(lesson===1){
    const id=code('Exosister Martha');
    content.innerHTML=`<div class="eyebrow">LOOK BEFORE YOU PLAY</div><h2>A card is more than its artwork.</h2><p>Select a face-up card or a card in your hand to inspect it. On a wide screen, its text appears on the left. On a small screen, it opens in a dialog.</p><div class="tour-demo"><div class="tour-zones"><div class="tour-zone"><button id="tour-inspect" aria-label="Inspect Exosister Martha">${image(id)}</button></div></div><div id="tour-status" class="tour-status">Select Exosister Martha to try the inspector.</div></div><div class="lesson-tip">You can inspect face-down cards you control. Your opponent’s hand, face-down field cards, and Extra Deck stay hidden. An Xyz monster’s materials appear in the inspector.</div>`;
    $('tour-inspect').onclick=()=>{inspectCard(id,{popup:true});$('tour-status').textContent='You opened the card inspector. Close it to continue.';completed.add(lesson);};
  }
  if(lesson===2){
    const id=code('Exosister Stella');
    content.innerHTML=`<div class="eyebrow">SELECT · CHOOSE · CONFIRM</div><h2>Make your first interface play.</h2><p>In a real duel, highlighted cards have legal actions. The Decision panel lists what you can do. Here, choose Normal Summon and watch Stella move to a Monster Zone.</p><div class="tour-demo"><div class="tour-zones">${Array.from({length:5},(_,i)=>`<div class="tour-zone" id="tour-zone-${i}">M${i+1}</div>`).join('')}</div><div id="tour-hand" style="width:64px">${image(id,'','style="width:100%"')}</div><button id="tour-summon" class="primary">Normal Summon Stella</button><div id="tour-status" class="tour-status">Stella is in your demonstration hand.</div></div><div class="lesson-tip">Targets, materials, positions, and zones can require a second decision. Select the required choices, then use Confirm selection. The OCG engine offers only legal actions in real duels.</div>`;
    $('tour-summon').onclick=()=>{$('tour-zone-2').innerHTML=image(id);$('tour-hand').innerHTML='';$('tour-summon').disabled=true;$('tour-status').textContent='Normal Summon complete. The next legal effect or response would appear in Decision.';completed.add(lesson);};
  }
  if(lesson===3){
    content.innerHTML=`<div class="eyebrow">YOUR TABLE AT A GLANCE</div><h2>Know whose decision it is.</h2><p>Your hand is at the bottom; your opponent is at the top. Each side has five Monster Zones, five Spell / Trap Zones, and a Field Zone. The two Extra Monster Zones sit between you.</p><div class="tour-demo"><div class="phase-strip" id="tour-phases">${['DP','SP','M1','BP','M2','EP'].map((v,i)=>`<button class="phase-pill ${i===2?'active':''}" data-tour-phase="${i}" style="min-width:40px;height:35px;font-size:.8rem">${v}</button>`).join('')}</div><div id="tour-status" class="tour-status">Main Phase 1: summon monsters, set cards, or activate legal effects.</div></div><div class="lesson-tip">The phase strip displays timing. Phase changes are chosen in Decision. On the first turn, the starting player does not draw or enter Battle Phase. When an effect can respond, Decision becomes a response window—even during the opponent’s turn.</div>`;
    const text=['Draw Phase: draw your turn card when the rules allow it.','Standby Phase: resolve effects scheduled for this phase.','Main Phase 1: summon monsters, set cards, or activate legal effects.','Battle Phase: choose an attacker, then a target. The engine handles battle timing.','Main Phase 2: make remaining legal plays after battle.','End Phase: resolve End Phase effects and discard to the hand limit when required.'];
    content.querySelectorAll('[data-tour-phase]').forEach(b=>b.onclick=()=>{content.querySelectorAll('[data-tour-phase]').forEach(x=>x.classList.toggle('active',x===b));$('tour-status').textContent=text[+b.dataset.tourPhase];completed.add(lesson);});
  }
  if(lesson===4){
    content.innerHTML=`<div class="eyebrow">A REPLAYABLE EXAMPLE</div><h2>Chains build up, then resolve backward.</h2><p>In your Main Phase, you activate Exosister Pax. Your opponent discards Ash Blossom to respond, and you answer with Called by the Grave. This demonstration shows the chain overlay, response window, and resolution order.</p><div class="tour-demo"><div class="tutorial-chain" id="tutorial-chain"></div><div id="chain-description" class="tour-status" aria-live="polite"></div><div class="chain-controls"><button class="primary" id="chain-play">Play animation</button><button class="subtle" id="chain-next">Step forward</button><button class="subtle" id="chain-reset">Reset</button></div></div><div class="lesson-tip">Costs are paid when an effect is activated: Pax pays 800 LP and Ash is discarded before the chain resolves. Negating an effect does not refund a paid cost. An effect’s targeting and cost rules still apply.</div>`;
    chainStep=0;renderChain();
    $('chain-next').onclick=()=>{stopChain();chainStep=Math.min(6,chainStep+1);renderChain();};
    $('chain-reset').onclick=()=>{stopChain();chainStep=0;renderChain();};
    $('chain-play').onclick=()=>{if(timer){stopChain();return;}if(chainStep>=6)chainStep=0;timer=setInterval(()=>{chainStep++;renderChain();if(chainStep>=6){stopChain();completed.add(lesson);}},2200);$('chain-play').textContent='Pause animation';};
  }
  if(lesson===5)content.innerHTML=`<div class="eyebrow">MAKE THE TABLE YOURS</div><h2>Bring a deck. Keep the practice.</h2><p>Use Deck workshop to add cards from the verified AE library. Main, Extra, and Side share each card’s copy limit. Select Side before adding cards intended for your Side Deck.</p><div class="lesson-mode-cards"><div><strong>Import a list</strong><p>Upload a .ydk file, paste a ydke:// link, or paste card names with quantities. Add the event name and source URL to remember where a tournament list came from.</p></div><div><strong>Check the format</strong><p>A tournament list can use a different pool or banlist. The workshop identifies missing AE printings, wrong sections, and excess copies before a duel.</p></div><div><strong>Review a practice</strong><p>Review tracks your summons, effects, response decisions, and current resources. Sequencing notes are suggestions, not proof of optimal play.</p></div></div><div class="lesson-tip">Saved decks stay in this browser. Export .ydk for backup or to move them to another device. Your AI opponent can use either included deck or any legal saved deck.</div><button id="tour-workshop" class="primary" style="margin-top:1.5rem">Open Deck workshop</button>`;
  $('lesson-prev').onclick=()=>{if(lesson>0){lesson--;renderLearn();}};
  $('lesson-next').onclick=()=>{completed.add(lesson);if(lesson<labels.length-1){lesson++;renderLearn();}else{modal('You know your way around.', '<p>You have completed the interface tour. Choose Practice for an AI duel, Local duel for another player, or Deck workshop to customize your deck.</p>');}};
  document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{lesson=+b.dataset.lesson;renderLearn();});
}
function stopChain(){clearInterval(timer);timer=null;if($('chain-play'))$('chain-play').textContent='Play animation';}
function renderChain(){
  const names=['Exosister Pax','Ash Blossom & Joyous Spring','Called by the Grave'];
  const shown=Math.min(3,Math.max(1,chainStep));
  const desc=[
    'Ready: you are in Main Phase. Use Play animation or Step forward.',
    'Chain Link 1 · You activate Exosister Pax and pay 800 LP. The opponent has a response window.',
    'Chain Link 2 · The opponent discards Ash Blossom as cost to negate Pax’s effect.',
    'Chain Link 3 · You activate Called by the Grave, targeting the discarded Ash in the opponent’s GY. Both players pass.',
    'Resolve Link 3 · Called by the Grave banishes Ash and applies its negation. No new links can be added during resolution.',
    'Resolve Link 2 · Ash Blossom’s effect is negated. Its discard cost stays paid.',
    'Resolve Link 1 · Exosister Pax resolves. Its effect was not negated, so its search can proceed.'
  ];
  $('tutorial-chain').innerHTML=names.slice(0,shown).map((name,i)=>`<div class="tutorial-link${chainStep>=4&&i===6-chainStep?' resolving':''}${chainStep>=4&&i>6-chainStep?' resolved':''}${chainStep>=5&&i===1?' negated':''}">${image(code(name))}<span>${i+1}</span></div>`).join('');
  $('chain-description').textContent=desc[chainStep];$('chain-next').disabled=chainStep>=6;
  if(chainStep>=6)completed.add(lesson);
}
export function stopLearn(){stopChain();}
