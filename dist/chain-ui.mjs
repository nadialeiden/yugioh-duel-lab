import {$,escape,image} from './ui.mjs';
import {cardName} from './data.mjs';
import {ChainPlayback} from './chain-events.mjs';
let expanded = false, minimized = false, lastEvent, lastViewer;
const panel = $('chain-overlay'), open = $('chain-open'), hide = $('chain-hide');
const details = $('chain-details'), skip = $('chain-skip'), content = $('chain-content');
const status = $('chain-status'), links = $('chain-links'), order = $('chain-order'), count = $('chain-count');

export const chainPlayback=new ChainPlayback({render:renderChain,onBusyChange:busy=>{
  document.body.classList.toggle('chain-playing',busy);
  const choices=$('decision-choices');if(choices)choices.inert=busy;
  const confirm=$('confirm-selection');if(confirm&&busy)confirm.disabled=true;
  window.dispatchEvent(new CustomEvent('chain-playback',{detail:{busy}}));
}});

function updateVisibility() {
  const hasChain = !!lastEvent?.links.length;
  panel.hidden = !hasChain || minimized;
  open.hidden = !hasChain || !minimized;
}

function updateDetails() {
  content.hidden = !details.hidden && !expanded;
  details.textContent = expanded ? 'Collapse' : 'Details';
  details.setAttribute('aria-expanded', String(expanded));
}

function renderChain(event, viewer, busy, state) {
  const previous = lastEvent;
  lastEvent = event;
  if (!event?.links.length) {
    expanded = minimized = false;
    links.replaceChildren();
    for (const key of ['kind','event','busy']) delete panel.dataset[key];
    updateVisibility();
    return;
  }

  const complete = event.kind === 'end';
  const link = event.links.find(c => c.number === event.number) || event.links.at(-1);
  const owner = link.player === viewer ? 'You' : 'Opponent';
  let title = complete ? 'Chain resolved' : event.kind === 'activate' ? `${owner} ${link.number > 1 ? 'chained' : 'activated'} · Link ${link.number}` :
    event.kind === 'negated' ? `Link ${link.number} negated` : `Resolving Link ${link.number}`;
  if (!busy && !complete) {
    title = state?.prompt?.player === viewer && state.prompt.type === 16 ? 'Your response window' :
      state?.prompt?.player !== viewer ? 'Waiting for opponent’s response' : 'Chain in progress';
  }
  if (status.textContent !== title) status.textContent = title;

  if (event !== previous || viewer !== lastViewer) {
    lastViewer = viewer;
    count.textContent = `${complete ? 'LAST CHAIN' : 'LIVE CHAIN'} · ${event.links.length} LINK${event.links.length > 1 ? 'S' : ''}`;
    const labels = {activated:'Activated', resolving:'Resolving…', negated:'NEGATED', resolved:'Resolved'};
    links.innerHTML = event.links.map(c => {
      const own = c.player === viewer;
      const name = escape(cardName(c.code));
      return `<button class="live-chain-card ${own ? 'your-link' : 'opponent-link'} ${c.status}" data-chain-card="${c.code}" data-link="${c.number}" aria-label="Chain Link ${c.number}, ${own ? 'your' : 'opponent’s'} ${name}, ${c.status}">
        <span class="chain-number">${c.number}</span>${image(c.code)}<span class="chain-card-copy"><small>${own ? 'YOU' : 'OPPONENT'}</small><strong>${name}</strong><em>${labels[c.status]}</em></span>
      </button>`;
    }).join('');
    order.textContent = complete ? 'Resolution complete.' : event.kind === 'activate' ?
      'Responses add links. Resolution runs from the highest link to Link 1.' : 'Resolving from the highest link to Link 1.';
  }
  if (!complete) expanded = false;
  panel.dataset.kind = event.kind;
  panel.dataset.event = event.id;
  panel.dataset.busy = String(busy);
  details.hidden = busy || !complete;
  skip.hidden = !busy;
  updateDetails();
  updateVisibility();
}

skip.onclick = () => chainPlayback.skip();
details.onclick = () => {
  expanded = !expanded;
  updateDetails();
};
hide.onclick = () => {
  minimized = true;
  updateVisibility();
  open.focus({preventScroll:true});
};
open.onclick = () => {
  minimized = false;
  updateVisibility();
  hide.focus({preventScroll:true});
};
