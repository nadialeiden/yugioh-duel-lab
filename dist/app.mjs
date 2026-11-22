import {$,escape,image,art,modal,closeModal,toast,download,typeName} from './ui.mjs';
import {cards,releases,rules,loadCatalog,loadScripts,readScript,cardName,effectText} from './data.mjs';
import {SECTIONS,emptyDeck,isExtra,parseDeck,exportYdk,validateDeck,safeView} from './model.mjs';
import {DuelSession} from './engine.mjs';
import {chooseBot} from './bot.mjs';
import {difficultyLabels} from './bot-strategy.mjs';
import {PracticeReview} from './evaluation.mjs';
import {LocalRoom,revivePacket} from './network.mjs';
import {configureDuelRenderer,renderBoard,renderTurnStatus,renderDecision,renderLog,renderReview,inspectCard,previewChoice,openPile,handleChoice,confirmSelection,cancelSelection,clearSelection,changeCounter} from './duel-render.mjs';
import {renderLearn,stopLearn} from './learn.mjs';
import {chainPlayback} from './chain-ui.mjs';
import {readSession, readProfile, saveProfileDeck} from './profiles.mjs';
import {showAccount} from './account-ui.mjs';
const entry = await readSession().catch(() => null);
if (!entry) {
  location.replace('/signin.html' + location.hash);
  // Hold initialization until the browser leaves this document.
  await new Promise(() => {});
}
const {id: accountId, expires} = entry;
const guestAccess = accountId === 'guest';
let starterDecks = [];
$('deck-screen').inert = true;
let mode='practice',loaded=false,library=[],editing=null,section='main',resultsLimit=24;
let session=null,review=null,viewer=0,botPlayer=1,botTimer=null,takeover=false,ended=false,currentState=null,duelMode=null;
let room=null,roomRole=null,guestDeck=null,roomCode='',pendingBotError=null,starting=false;
let previewedDeck=null;
const isTournamentDeck = deck => deck.provenance?.kind === 'tournament-ae';

function loadDeckLibrary() {
  const saved = readProfile(accountId).decks;
  const presets = starterDecks.filter(deck => !saved.some(entry => entry.id === deck.id)).map(deck => structuredClone(deck));
  library = [...saved, ...presets.filter(isTournamentDeck), ...presets.filter(deck => !isTournamentDeck(deck))];
}
function renderAccountName() {
  const name = readProfile(accountId).name;
  const button = $('account-button');
  button.textContent = guestAccess ? `Guest · ${Math.max(0, Math.ceil((expires - Date.now()) / 60000))}m` : name;
  button.setAttribute('aria-label', guestAccess ? 'Guest pass' : `Account settings for ${name}`);
  $('duelist-label').textContent = name;
  $('deck-library-label').textContent = `${name}’s decks`;
}
function canSwitchAccount() {
  if (starting || roomRole || (currentState && !ended && currentState.winner == null)) {
    throw new Error('Finish your duel or leave your room before switching accounts.');
  }
}
function endAccess() { location.replace('/signin.html?expired=1' + location.hash); }
async function recheckAccess() {
  if (Date.now() >= expires) return endAccess();
  try {
    const current = await readSession();
    if (!current) return endAccess();
    if (current.id !== accountId || current.expires !== expires) location.reload();
  } catch { /* The local duel can continue during a temporary network outage. */ }
}
setTimeout(endAccess, Math.max(0, expires - Date.now()));
window.addEventListener('pageshow', event => { if (event.persisted) recheckAccess(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) recheckAccess(); });
if (guestAccess) {
  for (const button of document.querySelectorAll('nav [data-mode="local"], nav [data-mode="decks"]')) button.hidden = true;
  setInterval(() => { renderAccountName(); recheckAccess(); }, 60000);
}
function busy(message){$('load-status').classList.remove('hidden');$('load-status').textContent=message;}
function idle(){$('load-status').classList.add('hidden');}
function deckById(id){return library.find(d=>d.id===id);}
function selectedDeck(control){return deckById($(control).value);}
function issues(deck){return validateDeck(deck,cards,rules,releases);}
function checkDeck(deck){if(!deck)throw new Error('Select a deck first.');const found=issues(deck);if(found.length)throw new Error(deck.name+': '+found.slice(0,3).join(' '));}
function refreshSelects(){
  const groups = [
    ['Tournament decks', library.filter(isTournamentDeck)],
    ['Practice presets and saved decks', library.filter(deck => !isTournamentDeck(deck))],
  ];
  const options = groups.filter(([, decks]) => decks.length).map(([label, decks]) =>
    `<optgroup label="${label}">${decks.map(deck => `<option value="${escape(deck.id)}">${escape(deck.name)}${issues(deck).length ? ' · needs revision' : ''}</option>`).join('')}</optgroup>`).join('');
  for (const id of ['practice-deck', 'bot-deck', 'local-deck']) {
    const select = $(id);
    const value = select.value;
    select.innerHTML = options;
    const defaultDeck = id === 'bot-deck' ? deckById('swordsoul') : library[0];
    select.value = deckById(value)?.id ?? defaultDeck?.id ?? library[0]?.id ?? '';
  }
}
function setMode(next){
  if (guestAccess && !['practice','learn'].includes(next)) {
    if (loaded) { toast('Sign in to use Local Duel or Deck Workshop.'); return; }
    next = 'practice';
  }
  mode=next;stopLearn();
  document.body.dataset.mode=next;
  document.body.classList.toggle('duel-visible',!!currentState&&duelMode===next);
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  $('duel-screen').classList.toggle('hidden',!['practice','local'].includes(mode));$('deck-screen').classList.toggle('hidden',mode!=='decks');$('learn-screen').classList.toggle('hidden',mode!=='learn');
  $('mode-kicker').textContent=mode==='local'?'THE LOCAL TABLE':'THE PRACTICE ROOM';
  $('room-title').textContent=mode==='local'?'A familiar table. A real opponent.':'A little sharper, every duel.';
  $('room-title').removeAttribute('data-turn-owner');
  if(currentState&&duelMode===next)renderTurnStatus(currentState,viewer);
  $('setup-panel').classList.toggle('hidden',mode!=='practice'||!!session||roomRole==='guest'&&duelMode==='local');
  $('local-panel').classList.toggle('hidden',mode!=='local'||duelMode==='local'&&!!currentState);
  if(mode==='learn'&&loaded)renderLearn({guest:guestAccess});if(mode==='decks'&&loaded)renderWorkshop();
  if(currentState&&['practice','local'].includes(mode)&&duelMode!==mode){
    // A running match continues only on its own table; navigation never silently replaces it.
    $('setup-panel').classList.toggle('hidden',mode!=='practice');$('local-panel').classList.toggle('hidden',mode!=='local');
  }
  history.replaceState(null,'','#'+mode);
}
function setRailExpanded(expanded){document.querySelector('.right-rail').classList.toggle('is-collapsed',!expanded);$('mobile-panel-toggle').setAttribute('aria-expanded',String(expanded));$('mobile-panel-label').textContent=expanded?'Show table':'Open decisions';}
function showRail(tab){setRailExpanded(true);for(const name of ['decision','log','evaluation']){$(name+'-panel').classList.toggle('hidden',name!==tab);$(name+'-tab').classList.toggle('active',name===tab);$(name+'-tab').setAttribute('aria-selected',String(name===tab));}}
function present(state){
  currentState=state;
  document.body.classList.toggle('duel-visible',duelMode===mode);
  renderBoard(state,viewer);renderLog(state);renderReview(review,state);
  renderDecision(takeover&&session?{...state,prompt:session.state.prompt}:state,viewer,{coach:duelMode==='practice'&&$('coach-toggle').checked,thinking:duelMode==='practice'&&session?.state.prompt?.player===botPlayer,ended,takeover});
  $('decision-panel').inert=chainPlayback.busy;
  if(state.prompt?.player===viewer&&state.promptId!==present.lastPrompt){present.lastPrompt=state.promptId;if(!chainPlayback.busy)showRail('decision');}
  $('surrender').disabled=ended||state.winner!==null;
}
function updateSession(state){
  clearTimeout(botTimer);
  const activeSession=session;
  const schedule=(callback,delay)=>chainPlayback.whenIdle().then(()=>{if(session===activeSession&&session.state.promptId===state.promptId&&!ended)botTimer=setTimeout(callback,delay);});
  present(session.view(viewer));
  if(roomRole==='host'&&duelMode==='local')room.send({type:'state',state:session.view(viewer^1),viewer:viewer^1,decks:session.decks.map(d=>({name:d.name})),ended});
  if(state.winner!==null){ended=true;if(duelMode==='practice')showRail('evaluation');return;}
  if(state.prompt?.type===16&&!state.prompt.forced&&!state.prompt.selects.length){const id=state.promptId;schedule(()=>{if(session?.state.promptId===id&&!ended)session.respond({type:8,index:null},id,state.prompt.player);},40);return;}
  if(duelMode==='practice'&&state.prompt?.player===botPlayer&&!takeover){
    const promptId=state.promptId;
    schedule(()=>{
      if(!session||session.state.promptId!==promptId||ended||takeover)return;
      try{const response=chooseBot(session.state.prompt,session,cards,review.difficulty);if(!response)throw new Error('No eligible response was found.');session.respond(response,promptId,botPlayer);}
      catch(error){pendingBotError=error;takeover=true;present(session.view(viewer));toast('The AI needs help with an unusual decision. Choose for it, then practice continues.');}
    },350);
  }
}
function sessionError(error){
  clearTimeout(botTimer);console.error(error);
  if(session?.state.prompt?.player===botPlayer&&duelMode==='practice'){takeover=true;pendingBotError=error;present(session.view(viewer));}
  else modal('Duel engine needs attention',`<p>${escape(error.message)}</p><p>The duel is paused so an invalid result is not treated as legal play. You can start a new duel.</p>`);
}
function respond(response){
  if(!currentState||ended)return;
  if(chainPlayback.busy)return;
  if(roomRole==='guest'&&duelMode==='local'){room.send({type:'response',response,promptId:currentState.promptId});$('decision-panel').innerHTML='<p class="muted">Sending your decision…</p>';return;}
  if(!session)return;
  const message=session.state.prompt;if(!message)return;
  const actor=takeover?botPlayer:viewer;
  if(message.player!==actor)return;
  if(review&&actor===viewer)review.record(message,response,session.state);
  takeover=false;pendingBotError=null;session.respond(response,session.state.promptId,actor);
}
configureDuelRenderer({respond,inspect:inspectCard});
async function startPractice(){
  if(starting)return;
  const own=selectedDeck('practice-deck'),opponent=selectedDeck('bot-deck');
  const difficulty=$('bot-difficulty').value;
  try{checkDeck(own);checkDeck(opponent);}catch(error){toast(error.message);return;}
  if(currentState&&!ended&&currentState.winner===null){modal('A duel is already in progress','<p>Concede or finish your current duel before starting another.</p>');return;}
  starting=true;$('start-practice').disabled=true;
  try{
    await loadScripts(busy);session?.destroy();room?.close();room=null;roomRole=null;duelMode='practice';ended=false;takeover=false;
    const order=$('turn-order').value;viewer=order==='second'?1:order==='random'?crypto.getRandomValues(new Uint8Array(1))[0]%2:0;botPlayer=viewer^1;
    const decks=viewer===0?[own,opponent]:[opponent,own];
    review=new PracticeReview(viewer,cards,difficulty);session=new DuelSession({cards,readScript,onUpdate:updateSession,onError:sessionError});
    $('your-deck-name').textContent=own.name;$('opponent-name').textContent=opponent.name;$('opponent-role').textContent=difficultyLabels[difficulty].toUpperCase()+' AI';$('arena').classList.add('live-duel');
    $('setup-panel').classList.add('hidden');$('local-panel').classList.add('hidden');showRail('decision');
    await session.start(decks);idle();
  }catch(error){session?.destroy();session=null;idle();toast('Could not start the duel: '+error.message);setMode('practice');}
  finally{starting=false;$('start-practice').disabled=!loaded;}
}
function confirmConcede(){
  if(!currentState||ended)return;
  modal('Concede this duel?',`<p>Your current duel will end. Saved decks remain available.</p><div class="modal-actions"><button class="subtle" data-action="close-modal">Keep playing</button><button class="primary" id="confirm-concede">Concede duel</button></div>`);
  $('confirm-concede').onclick=()=>{closeModal();clearTimeout(botTimer);ended=true;if(roomRole==='guest'){room.send({type:'surrender'});return;}session.state.winner=viewer^1;session.state.prompt=null;session.log('Player '+(viewer+1)+' concedes.');updateSession(session.state);};
}
function newDuel(){
  if(currentState&&!ended&&currentState.winner===null){confirmConcede();return;}
  clearTimeout(botTimer);session?.destroy();session=null;review=null;currentState=null;ended=false;duelMode=null;takeover=false;
  room?.close();room=null;roomRole=null;guestDeck=null;renderBoard(null);renderLog(null);document.body.classList.remove('duel-live','duel-visible');$('arena').classList.remove('live-duel');setMode(mode);
  $('decision-panel').innerHTML='<div class="waiting-icon">◇</div><h2>Ready for another?</h2><p class="muted">Choose your decks and take your seat.</p>';
}
async function ensureRoom(){
  if(currentState&&!ended&&currentState.winner===null)throw new Error('Finish or concede your current duel first.');
  checkDeck(selectedDeck('local-deck'));
  if(!room)room=new LocalRoom(onRoomMessage);await room.connect();
}
async function hostRoom(){try{await ensureRoom();roomRole='host';guestDeck=null;room.send({type:'create'});}catch(error){toast(error.message);}}
async function joinRoom(){try{await ensureRoom();const code=$('room-code').value.trim().toUpperCase();if(!/^[A-F0-9]{6}$/.test(code))throw new Error('Enter the six-character room code.');roomRole='guest';room.send({type:'join',code});}catch(error){toast(error.message);}}
function setRoomStatus(text){$('room-status').innerHTML=text;}
async function onRoomMessage(raw){
  const message=revivePacket(raw);
  try{
    switch(message.type){
      case 'created':roomCode=message.code;setRoomStatus('Room <strong class="room-code-display">'+escape(message.code)+'</strong><br>Share this code and this server’s LAN URL. Waiting for your opponent.');$('leave-room').classList.remove('hidden');break;
      case 'joined':roomCode=message.code;setRoomStatus('Joined room <strong>'+escape(message.code)+'</strong>. Sending your deck for validation…');$('leave-room').classList.remove('hidden');room.send({type:'deck',deck:selectedDeck('local-deck')});break;
      case 'guest-joined':setRoomStatus('Your opponent joined. Checking their deck…');break;
      case 'deck':
        if(roomRole!=='host')return;
        if(!message.deck||!SECTIONS.every(s=>Array.isArray(message.deck[s])&&message.deck[s].length<=60&&message.deck[s].every(v=>Number.isInteger(v))))throw new Error('Invalid deck payload.');
        checkDeck(message.deck);guestDeck=message.deck;setRoomStatus('Opponent ready: <strong>'+escape(guestDeck.name)+'</strong><br>The host goes first. Both decks are AE legal.');$('local-start').classList.remove('hidden');break;
      case 'starting':setRoomStatus('The host is loading the duel engine…');break;
      case 'state':
        if(roomRole!=='guest')return;duelMode='local';viewer=message.viewer;ended=message.ended||message.state.winner!==null;review=null;session=null;
        $('your-deck-name').textContent=message.decks[viewer]?.name||'Your deck';$('opponent-name').textContent=message.decks[viewer^1]?.name||'Local opponent';$('opponent-role').textContent='LOCAL OPPONENT';
        $('setup-panel').classList.add('hidden');$('local-panel').classList.add('hidden');present(message.state);break;
      case 'response':
        if(roomRole==='host'&&session?.state.prompt?.player===1&&message.promptId===session.state.promptId)session.respond(message.response,message.promptId,1);break;
      case 'surrender':if(roomRole==='host'&&session){ended=true;session.state.winner=0;session.state.prompt=null;session.log('Player 2 concedes.');updateSession(session.state);}break;
      case 'error':case 'rejected':setRoomStatus(escape(message.message||'This deck was rejected.'));toast(message.message||'Room action rejected.');break;
      case 'disconnected':case 'connection-closed':
        if(roomRole){clearTimeout(botTimer);ended=true;setRoomStatus('Room connection closed. Create or join another room to play again.');$('local-start').classList.add('hidden');if(currentState&&duelMode==='local'){$('decision-panel').innerHTML='<h2>Opponent disconnected.</h2><p class="muted">This duel has ended. Start a new local room to continue.</p>';$('surrender').disabled=true;}roomRole=null;}
        break;
    }
  }catch(error){toast(error.message);if(roomRole==='host')room.send({type:'rejected',message:error.message});}
}
async function startLocal(){
  if(!guestDeck||starting)return;starting=true;$('local-start').disabled=true;
  try{
    const own=selectedDeck('local-deck');checkDeck(own);checkDeck(guestDeck);room.send({type:'starting'});await loadScripts(busy);
    session?.destroy();viewer=0;botPlayer=null;review=null;ended=false;takeover=false;duelMode='local';
    session=new DuelSession({cards,readScript,onUpdate:updateSession,onError:sessionError});
    $('your-deck-name').textContent=own.name;$('opponent-name').textContent=guestDeck.name;$('opponent-role').textContent='LOCAL OPPONENT';$('local-panel').classList.add('hidden');$('setup-panel').classList.add('hidden');showRail('decision');
    await session.start([own,guestDeck]);idle();
  }catch(error){toast(error.message);idle();}finally{starting=false;$('local-start').disabled=false;}
}
function renderWorkshop(){
  if(!editing)editing=structuredClone(library[0]);
  $('saved-decks').innerHTML=library.map(d=>`<button class="saved-deck${d.id===editing.id?' active':''}" data-edit-deck="${escape(d.id)}">${escape(d.name)}<small>${d.main.length} Main · ${d.extra.length} Extra · ${d.side.length} Side</small></button>`).join('');
  $('deck-name').value=editing.name;renderDeckGrid();searchCards();
}
function renderDeckGrid(){
  for(const s of SECTIONS)$('count-'+s).textContent=editing[s].length;
  document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
  const found=issues(editing);$('deck-legality').classList.toggle('valid',!found.length);$('deck-legality').textContent=found.length?'Needs revision · '+found.length+' validation '+(found.length===1?'issue':'issues'):'AE legal · '+rules.date+' list · AE pool verified '+rules.checkedAt;
  $('legality-issues').innerHTML=found.length?found.map(i=>'<li>'+escape(i)+'</li>').join(''):'<li>Deck sizes, section placement, released AE card pool, and combined copy limits pass.</li>';
  const tournament = tournamentSource(editing);
  if (tournament) $('deck-provenance').innerHTML = tournament;
  else $('deck-provenance').textContent=editing.provenance?.event?'Imported list · '+editing.provenance.event:editing.provenance?.description||'Your custom practice deck.';
  const counts=new Map();for(const id of editing[section])counts.set(id,(counts.get(id)||0)+1);
  $('deck-grid').innerHTML=counts.size?[...counts].map(([id,n])=>`<div class="deck-card"><button data-inspect="${id}" aria-label="Inspect ${escape(cardName(id))}">${image(id)}<span class="quantity">×${n}</span></button><button class="remove-copy" data-remove="${id}" aria-label="Remove one ${escape(cardName(id))}">−</button></div>`).join(''):'<div class="empty-grid">This section is empty.<br>Find a card in the AE library and use + to add it.</div>';
}
function searchCards(){
  if(!loaded)return;
  const q=$('card-search').value.trim().toLowerCase(),type=$('type-filter').value,hide=$('legal-filter').checked;
  let result=[...cards.values()].filter(c=>c.ae&&(!q||c.name.toLowerCase().includes(q)||c.text.toLowerCase().includes(q))&&(!hide||(rules.konami_id_limits?.[c.cid]??rules.limits[c.name]??3)>0));
  const mask={monster:1,spell:2,trap:4,xyz:0x800000,synchro:0x2000,link:0x4000000,fusion:0x40}[type];if(mask)result=result.filter(c=>c.type&mask);
  // Prefer primary printings over alternate-art passcodes in search results.
  result=result.filter(c=>!c.alias||!cards.get(c.alias)?.ae||Math.abs(c.alias-c.code)>=10).sort((a,b)=>(a.name.toLowerCase().startsWith(q)?0:1)-(b.name.toLowerCase().startsWith(q)?0:1)||a.name.localeCompare(b.name));
  $('search-count').textContent=result.length.toLocaleString()+' AE cards'+(q?' matching your search':' · search to narrow the library');
  $('search-results').innerHTML=result.slice(0,resultsLimit).map(c=>{
    const limit=rules.konami_id_limits?.[c.cid]??rules.limits[c.name]??3;
    return `<div class="search-result"><button class="result-inspect" data-inspect="${c.code}" aria-label="Inspect ${escape(c.name)}">${image(c.code)}</button><button class="result-title" data-inspect="${c.code}"><strong>${escape(c.name)}</strong><small>${escape(typeName(c))}${limit<3?' · AE '+(limit===0?'Forbidden':'limit '+limit):''}</small></button><button class="add-copy" data-add="${c.code}" aria-label="Add ${escape(c.name)}">+</button></div>`;
  }).join('');$('more-results').classList.toggle('hidden',result.length<=resultsLimit);
}
function addToDeck(id){
  const c=cards.get(id);if(!c?.ae){toast('This card has no verified AE printing.');return;}
  const target=section==='side'?'side':isExtra(c)?'extra':'main';
  const count=SECTIONS.flatMap(s=>editing[s]).filter(code=>{const other=cards.get(code);return other?.cid===c.cid;}).length;
  const limit=rules.konami_id_limits?.[c.cid]??rules.limits[c.name]??3;
  if(count>=limit){toast(c.name+': the AE limit is '+limit+' across Main, Extra, and Side.');return;}
  if(editing[target].length>=(target==='main'?60:15)){toast(target+' Deck is full.');return;}
  editing[target].push(id);section=target;renderDeckGrid();
}
function saveDeck(){
  editing.name = $('deck-name').value.trim() || 'Untitled deck';
  if (isTournamentDeck(editing)) {
    editing.id = null;
    editing.provenance = {...editing.provenance, kind: 'tournament-custom'};
  }
  if (!editing.id) editing.id = 'deck-' + Date.now().toString(36) + '-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  try {
    saveProfileDeck(accountId, editing);
  } catch {
    toast('This browser could not save your deck. Export .ydk to keep a copy.');
    return;
  }
  loadDeckLibrary();
  refreshSelects();
  renderWorkshop();
  toast('Deck saved to ' + readProfile(accountId).name + '’s library.');
}
function importDialog(){
  modal('Import a deck',`<p>Upload a .ydk, paste a ydke:// link, or use card names with quantities. Include Main / Extra / Side section headings for text lists.</p><input class="file-input" id="deck-file" type="file" accept=".ydk,.txt"><textarea id="import-text" class="import-area" aria-label="Deck list" placeholder="#main&#10;3 Exosister Martha&#10;3 Exosister Elis&#10;#extra&#10;3 Exosister Mikailis&#10;!side"></textarea><div class="import-meta"><input id="import-title" placeholder="Deck / event name" aria-label="Deck or event name"><input id="import-source" placeholder="Tournament source URL (optional)" aria-label="Tournament source URL"></div><p id="import-status" role="status"></p><div class="modal-actions"><button class="subtle" data-action="close-modal">Cancel</button><button id="confirm-import" class="primary">Import into workshop</button></div>`);
  $('deck-file').onchange=async()=>{const f=$('deck-file').files[0];if(!f)return;if(f.size>100000){toast('Deck file is too large.');return;}$('import-text').value=await f.text();if(!$('import-title').value)$('import-title').value=f.name.replace(/\.[^.]+$/,'');};
  $('confirm-import').onclick=()=>{
    try{const {deck,errors}=parseDeck($('import-text').value,cards);if(errors.length){$('import-status').textContent=errors.slice(0,8).join('\n');return;}
      const source=$('import-source').value.trim();if(source&&!/^https?:\/\//i.test(source))throw new Error('Use an http or https source URL.');
      deck.id='deck-'+Date.now().toString(36);deck.name=$('import-title').value.trim()||'Imported deck';deck.provenance={kind:source?'user-supplied-tournament-list':'user-import',event:deck.name,source};editing=deck;section='main';closeModal();setMode('decks');toast('Deck imported. Review its AE legality, then Save.');
    }catch(error){$('import-status').textContent=error.message;}
  };
}
function tournamentSource(deck) {
  const source = deck.provenance;
  if (!source || !(isTournamentDeck(deck) || source.kind === 'tournament-custom')) return '';
  const label = source.kind === 'tournament-custom' ? 'Custom copy of' : 'Tournament list';
  const result = [label, source.placement, source.event, source.date, source.pilot].filter(Boolean).map(escape).join(' · ');
  const link = typeof source.source === 'string' && source.source.startsWith('https://')
    ? ` · <a href="${escape(source.source)}" target="_blank" rel="noreferrer">View published list</a>` : '';
  return result + link + (source.note ? '<br>' + escape(source.note) : '');
}
function previewDeck(deck){
  if(!deck)return;previewedDeck=deck;
  const tournament = tournamentSource(deck);
  modal(deck.name,`${tournament ? `<p class="muted">${tournament}</p>` : ''}<p>Read any card before starting your duel. This preview does not change the selected deck.</p>${SECTIONS.map(section=>{const counts=new Map();for(const id of deck[section])counts.set(id,(counts.get(id)||0)+1);return `<h3>${section[0].toUpperCase()+section.slice(1)} Deck · ${deck[section].length}</h3><div class="preview-deck-grid">${[...counts].map(([id,count])=>`<button class="preview-deck-card" data-preview-card="${id}" aria-label="Read ${escape(cardName(id))}">${image(id)}<span>${escape(cardName(id))}<small>×${count}</small></span></button>`).join('')}</div>`;}).join('')}`);
}
function showFormat(){
  modal('Your format and data',`<p><strong>OCG Master Rule (April 2020 revision)</strong>, with OCG trigger handling from the EDOPro core. The application uses the Asian-English card pool and its separate Forbidden & Limited List.</p><ul class="source-list"><li>Restriction list effective <strong>${escape(rules?.date||'Unavailable')}</strong>.</li><li>Pool checked <strong>${escape(rules?.checkedAt||'Unavailable')}</strong>.</li><li><a href="https://www.yugioh-card.com/asia/play/forbidden-and-limited-card-list-ae/" target="_blank" rel="noreferrer">Konami AE Forbidden & Limited List</a></li><li><a href="https://www.db.yugioh-card.com/yugiohdb/?request_locale=ae" target="_blank" rel="noreferrer">Official English (Asia) card database</a></li><li><a href="https://github.com/n1xx1/ocgcore-wasm" target="_blank" rel="noreferrer">ocgcore-wasm 0.1.7 / EDOPro core</a></li></ul><p>The date shown is a verified snapshot. Run the documented refresh command when Konami publishes new releases or restrictions. Card artwork is from the international card database; eligibility is checked against official AE identities.</p><p>Practice offers Beginner, Standard and Expert. Expert uses card-specific priorities where available and plans attacks against the visible board. Practice Review records the level used.</p>`);
}
function keyboardHelp(){modal('Keyboard shortcuts','<div class="kb-list"><p><kbd>1</kbd> Practice · <kbd>2</kbd> Local duel · <kbd>3</kbd> Deck workshop · <kbd>4</kbd> Learn</p><p><kbd>D</kbd> Decision · <kbd>L</kbd> Duel log · <kbd>R</kbd> Practice review</p><p><kbd>Esc</kbd> Close a dialog</p><p>All card actions remain available through the Decision panel. Keyboard shortcuts do not automatically activate cards or pass response windows.</p></div>');}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.readChoice!==undefined){previewChoice(+b.dataset.readChoice);return;}
  if(b.dataset.previewDeck){previewDeck(selectedDeck(b.dataset.previewDeck));return;}
  if(b.dataset.previewCard){inspectCard(+b.dataset.previewCard,{popup:true});$('modal-body').insertAdjacentHTML('beforeend','<button id="back-deck-preview" class="subtle full" style="margin-top:16px">Back to deck</button>');return;}
  if(b.id==='back-deck-preview'){previewDeck(previewedDeck);return;}
  if(b.dataset.chainCard){inspectCard(+b.dataset.chainCard,{popup:true});return;}
  if(b.dataset.mode){if(b.id==='tour-practice')closeModal();setMode(b.dataset.mode);return;}
  if(b.dataset.card!==undefined){
    const id=+b.dataset.card;if(!id){toast('That card is private.');return;}
    const player=+b.dataset.controller,location=+b.dataset.location,index=+b.dataset.sequence;
    const key={2:'hand',4:'monsters',8:'spells',16:'grave',32:'banished',64:'extra'}[location];
    const instance=currentState?.players[player]?.[key]?.[index];inspectCard(id,{instance,controller:player,location,sequence:index,allowActions:true});return;
  }
  if(b.dataset.pile){openPile(+b.dataset.controller,+b.dataset.pile);return;}
  if(b.dataset.choice!==undefined){if(chainPlayback.busy)return;closeModal();setRailExpanded(true);handleChoice(+b.dataset.choice);return;}
  if(b.dataset.declare){respond({type:18,card:+b.dataset.declare});return;}
  if(b.dataset.inspect){inspectCard(+b.dataset.inspect,{popup:mode==='decks'});return;}
  if(b.dataset.editDeck){editing=structuredClone(deckById(b.dataset.editDeck));renderWorkshop();return;}
  if(b.dataset.section){section=b.dataset.section;renderDeckGrid();return;}
  if(b.dataset.add){addToDeck(+b.dataset.add);return;}
  if(b.dataset.remove){const i=editing[section].indexOf(+b.dataset.remove);if(i>=0)editing[section].splice(i,1);renderDeckGrid();return;}
  switch(b.dataset.action){
    case 'guide':setMode('learn');break;
    case 'review':showRail('evaluation');break;
    case 'close-modal':closeModal();break;
    case 'export-review':if(review)download('practice-review.json',JSON.stringify(review.summary(session.state),null,2),'application/json');break;
    case 'export-log':download('duel-log.txt',currentState?.log.map(l=>'Turn '+l.turn+' · '+l.text).join('\n')||'');break;
  }
  if(b.id==='confirm-selection')confirmSelection();if(b.id==='cancel-selection')cancelSelection();if(b.id==='clear-selection')clearSelection();
});
document.addEventListener('input',event=>{if(event.target.dataset.counter!==undefined)changeCounter(+event.target.dataset.counter,event.target.value);});
document.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select')||$('modal').open)return;const key=event.key.toLowerCase();if('1234'.includes(key))setMode(['practice','local','decks','learn'][+key-1]);if(key==='d')showRail('decision');if(key==='l')showRail('log');if(key==='r')showRail('evaluation');});
$('close-modal').onclick=closeModal;$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
$('start-practice').onclick=startPractice;$('surrender').onclick=confirmConcede;$('new-duel').onclick=newDuel;
const difficultyNotes = {
  beginner: 'Simpler openings and fewer interruptions.',
  standard: 'Plays opening combos, saves interruptions, and plans short attack sequences.',
  expert: 'Uses tighter sequencing and looks further ahead in battle.',
};
$('bot-difficulty').onchange = event => { $('difficulty-note').textContent = difficultyNotes[event.target.value]; };
$('decision-tab').onclick=()=>showRail('decision');$('log-tab').onclick=()=>showRail('log');$('evaluation-tab').onclick=()=>showRail('evaluation');
$('mobile-panel-toggle').onclick=()=>setRailExpanded(document.querySelector('.right-rail').classList.contains('is-collapsed'));
window.addEventListener('chain-playback',event=>{
  if(event.detail.busy){setRailExpanded(false);return;}
  if(!currentState)return;
  renderDecision(takeover&&session?{...currentState,prompt:session.state.prompt}:currentState,viewer,{coach:duelMode==='practice'&&$('coach-toggle').checked,thinking:duelMode==='practice'&&session?.state.prompt?.player===botPlayer,ended,takeover});
  $('decision-panel').inert=false;
  if(currentState.prompt?.player===viewer&&!ended)showRail('decision');
});
$('create-room').onclick=hostRoom;$('join-room').onclick=joinRoom;$('local-start').onclick=startLocal;
$('leave-room').onclick=()=>{room?.close();room=null;roomRole=null;guestDeck=null;roomCode='';$('local-start').classList.add('hidden');$('leave-room').classList.add('hidden');setRoomStatus('You left the room.');};
$('save-deck').onclick=saveDeck;$('export-deck').onclick=()=>download((editing.name||'deck').replace(/[^a-z0-9-]/gi,'_')+'.ydk',exportYdk(editing));
$('create-deck').onclick=()=>{editing=emptyDeck('My new deck');section='main';renderWorkshop();};$('import-deck').onclick=importDialog;
for(const id of ['card-search','type-filter','legal-filter'])$(id).addEventListener(id==='card-search'?'input':'change',()=>{resultsLimit=24;searchCards();});
$('more-results').onclick=()=>{resultsLimit+=24;searchCards();};$('format-button').onclick=showFormat;$('keyboard-help').onclick=keyboardHelp;
for(const control of ['practice-deck','bot-deck','local-deck']){const button=document.createElement('button');button.className='text-button deck-preview-button';button.dataset.previewDeck=control;button.textContent='View deck cards';$(control).after(button);}
renderBoard(null);setMode(['practice','local','decks','learn'].includes(location.hash.slice(1))?location.hash.slice(1):'practice');
try{
  const data=await loadCatalog(busy);starterDecks=data.decks;
  loadDeckLibrary();
  renderAccountName();
  $('account-button').disabled=false;
  $('account-button').onclick=()=>showAccount({id:accountId,expires,canSwitch:canSwitchAccount,refreshName:renderAccountName});
  loaded=true;refreshSelects();$('start-practice').disabled=false;$('format-date').textContent=rules.date.slice(5).replace('-',' / ');
  $('deck-screen').inert = false;
  $('data-footer').textContent=data.poolCount.toLocaleString()+' AE identities · verified '+data.poolCheckedAt;
  idle();setMode(mode);
}catch(error){busy('Could not load the card library. '+error.message+' Start the app with npm start.');console.error(error);}
