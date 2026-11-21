import {$,escape,image} from './ui.mjs';
import {cardName} from './data.mjs';
import {ChainPlayback} from './chain-events.mjs';
let expanded=false, lastEvent, lastViewer, lastBusy, lastState;
export const chainPlayback=new ChainPlayback({render:renderChain,onBusyChange:busy=>{
  document.body.classList.toggle('chain-playing',busy);
  const choices=$('decision-choices');if(choices)choices.inert=busy;
  const confirm=$('confirm-selection');if(confirm&&busy)confirm.disabled=true;
  window.dispatchEvent(new CustomEvent('chain-playback',{detail:{busy}}));
}});
function renderChain(event,viewer,busy,state){
  lastEvent=event;lastViewer=viewer;lastBusy=busy;lastState=state;
  const panel=$('chain-overlay');if(!panel)return;
  if(!event?.links.length){panel.innerHTML='';panel.classList.remove('has-chain');return;}
  const complete=event.kind==='end', link=event.links.find(c=>c.number===event.number)||event.links.at(-1);
  const owner=link.player===viewer?'You':'Opponent';
  let title=complete?'Chain resolved':event.kind==='activate'?`${owner} ${link.number>1?'chained':'activated'} · Link ${link.number}`:event.kind==='negated'?`Link ${link.number} negated`:`Resolving Link ${link.number}`;
  if(!busy&&!complete)title=state?.prompt?.player===viewer&&state.prompt.type===16?'Your response window':state?.prompt?.player!==viewer?'Waiting for opponent’s response':'Chain in progress';
  const show=busy||!complete||expanded;
  panel.classList.add('has-chain');panel.dataset.kind=event.kind;panel.dataset.event=event.id;panel.dataset.busy=String(busy);
  panel.innerHTML=`<div class="chain-heading"><div><span class="chain-eyebrow">${complete?'LAST CHAIN':'LIVE CHAIN'} · ${event.links.length} LINK${event.links.length>1?'S':''}</span><strong role="status">${escape(title)}</strong></div>${busy?'<button class="chain-control" id="chain-skip" aria-label="Skip chain animation">Skip</button>':complete?`<button class="chain-control" id="chain-details" aria-expanded="${expanded}">${expanded?'Hide':'Details'}</button>`:''}</div>${show?`<div class="live-chain-links">${event.links.map(c=>`<button class="live-chain-card ${c.player===viewer?'your-link':'opponent-link'} ${c.status}" data-chain-card="${c.code}" data-link="${c.number}" aria-label="Chain Link ${c.number}, ${c.player===viewer?'your':'opponent’s'} ${escape(cardName(c.code))}, ${c.status}"><span class="chain-number">${c.number}</span>${image(c.code)}<span class="chain-card-copy"><small>${c.player===viewer?'YOU':'OPPONENT'}</small><strong>${escape(cardName(c.code))}</strong><em>${c.status==='activated'?'Activated':c.status==='resolving'?'Resolving…':c.status==='negated'?'NEGATED':'Resolved'}</em></span></button>`).join('')}</div><p class="chain-order">${complete?'Resolution complete.':event.kind==='activate'?'Responses add links. Resolution runs from the highest link to Link 1.':'Resolving from the highest link to Link 1.'}</p>`:''}`;
}
document.addEventListener('click',event=>{
  if(event.target.closest('#chain-skip'))chainPlayback.skip();
  if(event.target.closest('#chain-details')){expanded=!expanded;renderChain(lastEvent,lastViewer,lastBusy,lastState);}
});
