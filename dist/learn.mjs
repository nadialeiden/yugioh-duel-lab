import {$, escape, image, modal} from './ui.mjs';
import {cards} from './data.mjs';
import {inspectCard} from './duel-render.mjs';

let lesson = 0;
let chainStep = 0;
let timer = null;
const cardCode = name => [...cards.values()].find(card => card.name === name)?.code;
const headings = [
  'Set up a duel', 'Read the table', 'Try your first turn', 'Follow the phases',
  'Respond and chain', 'Finish and review', 'Build a deck or join a room',
];
const phases = [
  ['DP', 'Draw Phase', 'Draw one card. Both players start with five cards and 8,000 LP. The starting player skips their first draw.'],
  ['SP', 'Standby Phase', 'Resolve effects that happen during this phase. The game moves on when there is nothing to handle.'],
  ['M1', 'Main Phase 1', 'Use Decision to summon, set a card face-down, or activate an effect. You normally get one Normal Summon or Normal Set of a monster per turn. Special Summons have their own requirements.'],
  ['BP', 'Battle Phase', 'Choose Enter Battle Phase when available. In Decision, pick Attack for a monster, then choose a target or a direct attack if offered. The first player skips battle on turn one.'],
  ['M2', 'Main Phase 2', 'If you entered the Battle Phase, you can choose Main Phase 2 and make more legal plays. This phase shares the turn’s usual Normal Summon allowance.'],
  ['EP', 'End Phase', 'Choose End turn. Handle any remaining effects or responses. You can hold more than six cards during play. In a standard End Phase, the turn player discards down to six if needed.'],
];

function openPreview(name) {
  inspectCard(cardCode(name), {popup: true, updateInspector: false});
}

function demoCard(name, label = name) {
  return `<span class="learn-card">${image(cardCode(name))}<strong>${escape(label)}</strong></span>`;
}

function overview() {
  return `
    <h2>Start with a Practice duel</h2>
    <p>Choose <strong>Practice</strong> in the navigation. Try this setup for your first game against the AI.</p>
    <ol class="learn-steps">
      <li><strong>Pick two decks.</strong> Try Exosister for yourself and choose any AI deck. Use <strong>View deck cards</strong> to read either list before you start.</li>
      <li><strong>Set the difficulty and turn order.</strong> Try Beginner, <strong>I go first</strong>, and leave <strong>Practice helpers</strong> enabled for timing tips.</li>
      <li><strong>Start practice duel.</strong> Check whose turn it is, then open <strong>Decision</strong> to see your available plays.</li>
    </ol>
    <p class="lesson-tip">This tour uses examples you can replay here. Your first real duel starts when you choose <strong>Start practice duel</strong> in Practice.</p>`;
}

function tableLesson(content) {
  const name = 'Exosister Martha';
  content.innerHTML = `
    <h2>Find your cards and decisions</h2>
    <dl class="learn-glossary">
      <div><dt>Turn and phase</dt><dd>At the top of the table, look for <strong>Your turn</strong> or <strong>Opponent’s turn</strong>. The highlighted phase below the opponent’s field shows where that turn is.</dd></div>
      <div><dt>Hand, field, and piles</dt><dd>Your hand sits at the bottom and the opponent’s at the top. Monsters and Spell/Trap cards have separate rows. Tap <strong>GY</strong> for the Graveyard, <strong>Banish</strong> for banished cards, or <strong>Extra</strong> for the Extra Deck.</dd></div>
      <div><dt>Decision</dt><dd>Choose your actions and responses here. On a phone, tap <strong>Open decisions</strong> if the panel is collapsed, and <strong>Show table</strong> to return to the field.</dd></div>
    </dl>
    <div class="tour-demo learn-inspect">
      <div class="tour-zone"><button id="tour-inspect" aria-label="Inspect Exosister Martha">${demoCard(name, 'Martha')}</button></div>
      <div><strong>Try the Card Inspector</strong><p>Tap Martha to read her effect, ATK, and DEF. In a duel you can inspect a card from the hand or field, or use <strong>Read card</strong> next to a legal action.</p></div>
    </div>
    <p class="lesson-tip">On a wide screen the inspector is on the left. On a phone it opens over the table. Swipe along your hand to reach cards beyond the visible ones.</p>`;
  $('tour-inspect').onclick = () => openPreview(name);
}

function firstTurn(content) {
  const name = 'Exosister Stella';
  const art = demoCard(name, 'Stella');
  let zone = null;
  content.innerHTML = `
    <h2>Summon a monster and end your turn</h2>
    <p>Try a first-turn play with Stella. The example hand shows just the card you’ll use.</p>
    <div class="tour-demo learn-turn-demo">
      <div class="learn-turn-bar" id="tour-turn"><strong id="tour-owner">Your turn</strong><span id="tour-turn-phase">Turn 1 · Main Phase 1</span></div>
      <div class="learn-turn-grid">
        <div class="learn-mat" aria-label="Example field">
          <span class="tiny-label">YOUR MONSTER ZONES</span>
          <div class="tour-zones learn-zones">${Array.from({length: 5}, (_, i) => `<button type="button" class="tour-zone" data-tour-zone="${i}" aria-label="Your Monster Zone ${i + 1}" aria-pressed="false" disabled>M${i + 1}</button>`).join('')}</div>
          <span class="tiny-label">YOUR HAND</span>
          <button id="tour-hand" class="tour-zone" aria-label="Inspect Exosister Stella">${art}</button>
        </div>
        <div class="learn-decision">
          <span class="tiny-label">DECISION</span>
          <h3 id="tour-prompt">Choose your play</h3>
          <div id="tour-actions" class="learn-actions">
            <button id="tour-summon" class="primary">Normal Summon Stella</button>
            <button id="tour-read" class="subtle">Read card</button>
          </div>
        </div>
      </div>
      <p id="tour-status" class="tour-status" role="status">Read Stella’s effect, then choose Normal Summon Stella in Decision.</p>
    </div>
    <p class="lesson-tip">The game may ask you to choose a zone, target, position, or materials. You can change a selection before pressing <strong>Confirm selection</strong>. Some decisions then open a response window.</p>`;
  const zones = [...content.querySelectorAll('[data-tour-zone]')];
  const status = $('tour-status');
  const actions = $('tour-actions');
  $('tour-hand').onclick = $('tour-read').onclick = () => openPreview(name);
  $('tour-summon').onclick = () => {
    $('tour-prompt').textContent = 'Choose a zone';
    zones.forEach(button => { button.disabled = false; });
    actions.innerHTML = '<button id="tour-confirm" class="primary" disabled>Confirm selection</button>';
    status.textContent = 'Choose one of your five Monster Zones.';
    zones[0].focus({preventScroll: true});
    $('tour-confirm').onclick = () => {
      zones.forEach(button => { button.disabled = true; button.setAttribute('aria-pressed', 'false'); });
      zones[zone].innerHTML = art;
      zones[zone].setAttribute('aria-label', `Exosister Stella in Monster Zone ${zone + 1}`);
      $('tour-hand').replaceWith('No more cards in this example hand.');
      $('tour-prompt').textContent = 'Choose your next play';
      actions.innerHTML = '<button id="tour-end" class="primary">End turn</button>';
      status.textContent = 'Stella is on the field. End turn is available. The starting player cannot battle on the first turn.';
      $('tour-end').focus({preventScroll: true});
      $('tour-end').onclick = () => {
        $('tour-turn').classList.add('opponent-turn');
        $('tour-owner').textContent = 'Opponent’s turn';
        $('tour-turn-phase').textContent = 'Turn 2 · Draw Phase';
        $('tour-prompt').textContent = 'Waiting for your opponent';
        actions.innerHTML = '<button id="tour-restart" class="subtle">Try the turn again</button>';
        status.textContent = 'The opponent starts their turn. If you have a legal response, Decision will open a prompt for you during their turn.';
        $('tour-restart').onclick = () => firstTurn(content);
        $('tour-restart').focus({preventScroll: true});
      };
    };
  };
  zones.forEach((button, index) => {
    button.onclick = () => {
      zone = zone === index ? null : index;
      zones.forEach((choice, i) => choice.setAttribute('aria-pressed', String(i === zone)));
      $('tour-confirm').disabled = zone === null;
      status.textContent = zone === null ? 'Selection cleared. Choose a Monster Zone.' :
        `Monster Zone ${zone + 1} selected. Tap another zone to change it, or Confirm selection.`;
    };
  });
}

function phaseLesson(content) {
  content.innerHTML = `
    <h2>Follow a turn from Draw to End</h2>
    <p>Select a phase below to see what happens. During a duel, the phase strip shows your progress and <strong>Decision</strong> offers the available phase changes.</p>
    <div class="tour-demo learn-phase-demo">
      <div class="learn-phases" id="tour-phases" aria-label="Explore the turn phases">
        ${phases.map(([short, label], i) => `<button type="button" class="subtle" data-tour-phase="${i}" aria-pressed="false"><small>${short}</small>${label}</button>`).join('')}
      </div>
      <p id="tour-status" class="tour-status" role="status"></p>
    </div>
    <p class="lesson-tip">A typical opening turn is <strong>Draw → Standby → Main 1 → End</strong>, with no draw for the starting player. On later turns, you can move to End from Main 1 or enter Battle and then Main 2 when available.</p>`;
  const buttons = [...content.querySelectorAll('[data-tour-phase]')];
  function selectPhase(index) {
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    $('tour-status').textContent = phases[index][2];
  }
  buttons.forEach((button, i) => { button.onclick = () => selectPhase(i); });
  selectPhase(2);
}

const chainCards = ['Exosister Pax', 'Ash Blossom & Joyous Spring', 'Called by the Grave'];
const chainFrames = [
  ['Main Phase 1', 'Step forward to activate Exosister Pax, or play the full animation.'],
  ['Opponent can respond', 'Chain Link 1 · You activate Exosister Pax and pay 800 LP. The opponent gets the next chance to respond.'],
  ['Your response window', 'Chain Link 2 · The opponent discards Ash Blossom as cost. Use Read card to check your response, Called by the Grave. If you pass and the chain resolves here, Ash negates Pax’s effect.'],
  ['Both players pass', 'Chain Link 3 · You activate Called by the Grave targeting Ash in their GY. Both players pass, so the chain starts resolving.'],
  ['Resolving · Link 3', 'Resolve Link 3 · Called by the Grave banishes Ash and applies its negation. No one can add new links during resolution.'],
  ['Resolving · Link 2', 'Resolve Link 2 · Ash Blossom’s effect is negated. Its discard cost stays paid.'],
  ['Chain complete', 'Resolve Link 1 · Exosister Pax resolves and its search can proceed. Follow the next prompt in Decision.'],
];

function chainLesson(content) {
  content.innerHTML = `
    <h2>Respond to an effect and watch the chain</h2>
    <p>When <strong>Response window</strong> appears in Decision, choose an available effect or <strong>Pass response</strong> if offered. A response can be yours even during the opponent’s turn.</p>
    <div class="tour-demo learn-chain-demo">
      <div class="learn-turn-bar"><strong>Your turn</strong><span id="chain-stage"></span></div>
      <div class="tutorial-chain" id="tutorial-chain" aria-label="Chain links"></div>
      <p id="chain-description" class="tour-status" role="status"></p>
      <button id="chain-read" class="subtle hidden">Read card · Called by the Grave</button>
      <div class="chain-controls">
        <button class="primary" id="chain-play">Play animation</button>
        <button class="subtle" id="chain-prev">Step back</button>
        <button class="subtle" id="chain-next">Step forward</button>
        <button class="subtle" id="chain-reset">Reset</button>
      </div>
    </div>
    <p class="lesson-tip">The overlay numbers links as players add them. Once both players pass, resolve newest to oldest. Costs already paid at activation stay paid if an effect is negated. Open <strong>Duel log</strong> to read the chain after the overlay closes.</p>`;
  chainStep = 0;
  renderChain();
  $('chain-read').onclick = () => { stopLearn(); openPreview(chainCards[2]); };
  $('chain-next').onclick = () => moveChain(chainStep + 1);
  $('chain-prev').onclick = () => moveChain(chainStep - 1);
  $('chain-reset').onclick = () => moveChain(0);
  $('chain-play').onclick = () => {
    if (timer) return stopLearn();
    if (chainStep === chainFrames.length - 1) moveChain(0);
    timer = setInterval(() => {
      chainStep++;
      renderChain();
      if (chainStep === chainFrames.length - 1) stopLearn();
    }, 2400);
    $('chain-play').textContent = 'Pause animation';
  };
}

function moveChain(step) {
  stopLearn();
  chainStep = step;
  renderChain();
}

function renderChain() {
  const [stage, description] = chainFrames[chainStep];
  const resolving = chainStep >= 4 ? 6 - chainStep : -1;
  $('chain-stage').textContent = stage;
  $('tutorial-chain').innerHTML = chainStep === 0 ? '<p class="muted">The chain is empty.</p>' :
    chainCards.slice(0, Math.min(3, chainStep)).map((name, i) => `
      <div class="tutorial-link${i === resolving ? ' resolving' : ''}${resolving >= 0 && i > resolving ? ' resolved' : ''}${chainStep >= 5 && i === 1 ? ' negated' : ''}"
          aria-label="Link ${i + 1}, ${escape(name)}">
        <div class="learn-chain-card">${demoCard(name)}</div><span aria-hidden="true">${i + 1}</span>
      </div>`).join('');
  $('chain-description').textContent = description;
  $('chain-read').classList.toggle('hidden', chainStep !== 2);
  $('chain-next').disabled = chainStep === chainFrames.length - 1;
  $('chain-prev').disabled = chainStep === 0;
}

function reviewLesson() {
  return `
    <h2>See the result and review your plays</h2>
    <p>When a player’s LP reaches 0, the duel ends. Check <strong>Decision</strong> for the result or the <strong>Duel log</strong> for how it ended. Use <strong>Concede</strong> if you need to end the duel early.</p>
    <dl class="learn-glossary">
      <div><dt>Duel log</dt><dd>Read recent actions with the newest at the top. Use it to check which effect started a chain, which card responded, and how the chain resolved.</dd></div>
      <div><dt>Review</dt><dd>In Practice, check how many summons, effects, and responses you used, plus the cards you have left. Start by finding one turn in the log where you’d like to try a different play.</dd></div>
      <div><dt>New duel</dt><dd>Return to setup and try the same matchup again, or switch the opponent deck, difficulty, or turn order.</dd></div>
    </dl>`;
}

function deckLesson(guest) {
  return `
    <h2>Play with your own deck or a friend</h2>
    <dl class="learn-glossary">
      <div><dt>Deck workshop</dt><dd>Create a deck or import a .ydk file, YDKE link, or list of card names. Check the Main, Extra, and Side Decks against the Asian-English card pool and restriction list, then save and pick your deck in duel setup.</dd></div>
      <div><dt>Local duel</dt><dd>Open the site on both devices and choose Local Duel. One player creates a room and shares its six-character code. The other player chooses their deck, enters the code, and joins. The host starts the duel.</dd></div>
      <div><dt>Practice</dt><dd>Pick a legal deck for either side. Use a starter deck for a quick match, or select a deck you saved in the workshop.</dd></div>
    </dl>
    ${guest ? '<p class="lesson-tip">Sign in to use Deck Workshop or join a Local Duel. Guest passes include Practice with starter decks and this tour.</p>' : ''}
    <p>For card and timing rules, see <a href="https://www.yugioh-card.com/asia/play/ocg-rulebook/" target="_blank" rel="noreferrer">Konami’s OCG rulebook</a>.</p>`;
}

export function renderLearn({guest = false} = {}) {
  stopLearn();
  const list = $('lesson-list');
  list.innerHTML = headings.map((name, index) => `
    <button data-lesson="${index}"${lesson === index ? ' class="active" aria-current="step"' : ''}>${escape(name)}</button>`).join('');
  $('lesson-progress').textContent = `Lesson ${lesson + 1} of ${headings.length}`;
  $('lesson-prev').disabled = lesson === 0;
  $('lesson-next').textContent = lesson === headings.length - 1 ? 'Finish tour' : 'Next lesson';
  const content = $('lesson-content');
  if (lesson === 0) content.innerHTML = overview();
  if (lesson === 1) tableLesson(content);
  if (lesson === 2) firstTurn(content);
  if (lesson === 3) phaseLesson(content);
  if (lesson === 4) chainLesson(content);
  if (lesson === 5) content.innerHTML = reviewLesson();
  if (lesson === 6) content.innerHTML = deckLesson(guest);

  function goTo(index) {
    lesson = index;
    renderLearn({guest});
    const heading = content.querySelector('h2');
    heading.tabIndex = -1;
    heading.focus();
  }
  $('lesson-prev').onclick = () => goTo(lesson - 1);
  $('lesson-next').onclick = () => {
    if (lesson < headings.length - 1) return goTo(lesson + 1);
    modal('Tour complete', `
      <p>Try a Beginner practice duel with helpers enabled. You can return to any lesson from Learn the interface.</p>
      <button id="tour-practice" class="primary" data-mode="practice">Go to Practice</button>`);
  };
  list.querySelectorAll('[data-lesson]').forEach(button => { button.onclick = () => goTo(+button.dataset.lesson); });
}

export function stopLearn() {
  clearInterval(timer);
  timer = null;
  if ($('chain-play')) $('chain-play').textContent = 'Play animation';
}
