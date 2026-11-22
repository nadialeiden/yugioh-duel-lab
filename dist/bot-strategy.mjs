export const difficultyLabels = Object.freeze({beginner: 'Beginner', standard: 'Standard', expert: 'Expert'});

const handTraps = new Set([
  'Ash Blossom & Joyous Spring', 'Effect Veiler', 'Ghost Ogre & Snow Rabbit', 'Ghost Belle & Haunted Mansion',
  'Ghost Mourner & Moonlit Chill', 'Infinite Impermanence', 'Maxx "C"', 'Nibiru, the Primal Being', 'Dimension Shifter',
  'Droll & Lock Bird', 'Mulcharmy Fuwalos', 'Mulcharmy Purulia', 'Mulcharmy Meowls',
]);
const dominusLocks = new Map([['Dominus Impulse', 1|8|16], ['Dominus Purge', 2|4|32], ['Dominus Spark', 1|2|4|8]]);
const removal = new Set(['Raigeki', "Harpie's Feather Duster", 'Swordsoul Blackout', 'Dogmatika Punishment', 'EXTINGUISH!', 'Destructive Daruma Karma Cannon', "Ice Dragon's Prison", 'Salamangreat Rage']);
const starterThreats = new Set([
  'Exosister Pax', 'Exosister Martha', 'Exosister Betrayal', 'Aratama', 'Swordsoul of Mo Ye', 'Swordsoul of Taia',
  'Swordsoul Emergence', 'Rescue-ACE Air Lifter', 'Rescue-ACE Turbulence', 'EMERGENCY!',
  'Salamangreat Gazelle', 'Salamangreat of Fire', 'Cynet Mining', 'Salamangreat Circle',
  'Wishes for Eyes of Blue', 'Maiden of White', 'Roar of the Blue-Eyed Dragons',
  'Arianna the Labrynth Servant', 'Big Welcome Labrynth', 'Welcome Labrynth',
  'Griffoh', 'Ragged Records of Rites', 'Black Chaos', 'Light and Darkness Ritual', 'Ame no Habakiri no Mitsurugi',
  'Mitsurugi Ritual', 'Mitsurugi Prayers', 'Elfnote Lucina', 'Elfnote Regina', 'Elfnote Tinia',
  'Medius the Pure', 'Prohibited Power Patron Portal - Terminus', 'Nervedo the Shadebeast Power Patron',
  'Rahu Dracotail', 'Ketu Dracotail', 'Dracotail Lukias', 'Dracotail Mululu', 'Dracotail Faimena',
  'Branded Fusion', 'Blazing Cartesia, the Virtuous', 'Fallen of the White Dragon', 'The Fallen & The Virtuous',
]);
const endBoard = new Set([
  'Exosisters Magnifica', 'Exosister Mikailis', 'Swordsoul Grandmaster - Chixiao',
  'Swordsoul Supreme Sovereign - Chengying', 'Swordsoul Sinister Sovereign - Qixing Longyuan',
  'Rescue-ACE Arbitrator', 'Rescue-ACE Turbulence', 'Salamangreat Raging Phoenix',
  'Promethean Princess, Bestower of Flames', 'Blue-Eyes Spirit Dragon', 'Blue-Eyes Ultimate Spirit Dragon',
  'Hieratic Seal of the Heavenly Spheres', 'Lady Labrynth of the Silver Castle', 'Lovely Labrynth of the Silver Castle',
  'S:P Little Knight', 'I:P Masquerena', 'Chaos Angel', 'Cosmic Blazar Dragon',
  'Exosister Karmael', 'Ame no Murakumo no Mitsurugi', 'Magician of Dark Chaos - Black Chaos',
  'Black Luster Soldier - Soldier of Light and Darkness', 'Mirrorjade the Iceblade Dragon',
  'Dracotail Arthalion', 'Dracotail Gulamel', 'Baronne de Fleur', 'Crystal Wing Synchro Dragon',
  'Elfnote June Pride', 'Jupiter the Power Patron of Destruction', 'Varudras, the Final Bringer of the End Times',
]);
const sourceName = (card, cards) => cards.get(card?.code)?.name || '';
const attack = (card, cards) => Math.max(0, card?.attack ?? cards.get(card?.code)?.attack ?? 0);

function effectDescription(description, cards) {
  const id = BigInt(description || 0);
  return cards.get(Number(id >> 20n))?.strings?.[Number(id & 0xfffffn)] || '';
}

export function mainAction(choice, context, score, difficulty) {
  const {action} = choice.response;
  const {own, enemy, state, player, cards, prompt, observations} = context;
  const entry = choice.card, card = cards.get(entry?.code), name = card?.name || '';
  const monsters = own.monsters.filter(Boolean);
  const threats = enemy.monsters.filter(Boolean).length;
  const expert = difficulty === 'expert';
  const ownHand = own.hand.map(c => sourceName(c, cards));
  const ownField = monsters.map(c => sourceName(c, cards));
  const usable = (list, target) => list?.some(c => sourceName(c, cards) === target);
  const summon = action === 0 || action === 1;
  const activation = action === 5;
  const extra = entry?.location === 64;

  if (action === 0 && handTraps.has(name)) return -42;
  if (action === 4) {
    const reactive = card?.type & (4 | 65536);
    const activeFromHand = name === 'Infinite Impermanence' && !monsters.length && !own.spells.some(Boolean);
    return reactive && !activeFromHand ? 27 : -31;
  }
  if (action === 3) return monsters.length || (card?.defense || 0) < 800 ? -29 : 4;
  if (action === 2) {
    if (state.phase === 'Main 1' && prompt.to_bp && entry && attack(own.monsters[entry.sequence], cards) > 0 && (own.monsters[entry.sequence]?.position & 4)) return 16;
    return -32;
  }
  if (action === 6) return monsters.some(c => (c.position & 1) && attack(c,cards)) ? 24 : -40;
  if (!summon && !activation) return score;

  if (activation && name === 'Raigeki') return threats >= 2 ? 240 : threats ? 130 : -90;
  if (activation && /^Harpie.s Feather Duster$/.test(name)) {
    const backRow = enemy.spells.filter(Boolean).length;
    return backRow > 1 ? 235 : backRow ? 124 : -90;
  }
  if (activation && name === 'Called by the Grave') return -35;
  if (activation && handTraps.has(name) && (entry.location === 2 || entry.location === 8)) {
    if (name === 'Infinite Impermanence' && threats) return 96;
    return -38;
  }

  let value = score;
  if (activation && name === 'Exosister Mikailis' && (BigInt(entry.description || 0) & 0xfffffn) === 0n) {
    value += threats ? 38 : -35;
  }
  if (starterThreats.has(name) && (activation || action === 0 || action === 1 && entry.location === 2)) value += 40;
  if (extra && action === 1 && endBoard.has(name)) value += 38;
  if (action === 0 && /^Elfnote (Lucina|Tinia)$/.test(name) && usable(prompt.special_summons, name)) value -= 65;
  if (action === 0 && name === 'Elfnote Regina' && own.monsters[2]) value -= 50;
  if (action === 0 && monsters.some(c => endBoard.has(sourceName(c, cards))) && !starterThreats.has(name)) value -= 55;
  if (activation && name === 'Dark Hole') return threats > monsters.length ? value + 65 : -90;
  if (activation && (dominusLocks.has(name) || /^(Crossout Designator|Exosister Vadis)$/.test(name))) return -35;
  if (activation && name === 'Exosister Returnia') return threats ? value + 65 : -25;
  if (action === 0 && name === 'Swordsoul of Mo Ye') {
    const canReveal = own.hand.some((c, index) => index !== entry.sequence &&
      (/Swordsoul/.test(sourceName(c, cards)) || Number(cards.get(c.code)?.race) === 0x800000));
    if (!canReveal) return 5;
  }
  if (action === 0 && usable(prompt.activates, 'Exosister Martha')) value -= 100;
  if (action === 0 && name === 'Exosister Martha') value -= 20;

  if (difficulty === 'beginner') return value + (action === 0 ? 30 : 0);
  if (activation && name === 'Exosister Betrayal' && !monsters.length) value += 46;
  if (activation && /^(Ragged Records of Rites|Mitsurugi Prayers|Branded Fusion|Rahu Dracotail)$/.test(name)) value += 45;
  if (action === 0 && name === 'Medius the Pure') value += 50;
  if (action === 1 && extra && name === 'Number 41: Bagooska the Terribly Tired Tapir') value -= monsters.length > 1 && monsters.some(c => endBoard.has(sourceName(c,cards))) ? 135 : 35;
  if (action === 1 && extra && !endBoard.has(name) && monsters.some(c => endBoard.has(sourceName(c, cards)))) value -= 82;
  if (observations?.drawTax?.[player ^ 1] && action === 1) value -= monsters.length && !threats ? (expert ? 152 : 130) : 70;
  if (!expert) return value;

  if (activation && /^(Exosister Martha|Exosister Stella|Exosister Elis|Sakitama)$/.test(name)) value += 60;
  if (name === 'Exosister Pax' && activation && !(ownHand.includes('Exosister Martha') || monsters.length >= 2)) value += 44;
  if (name === 'Exosisters Magnifica' && extra && action === 1) value += 90;
  if (extra && action === 1 && name === 'Exosister Kaspitell' && !ownHand.includes('Exosister Martha') && !ownHand.includes('Exosister Elis')) value += 42;
  if (extra && action === 1 && name === 'Exosister Mikailis' && threats) value += 43;
  if (action === 0 && name === 'Swordsoul of Mo Ye') value += 43;
  if (activation && name === 'Swordsoul Emergence' && !ownHand.includes('Swordsoul of Mo Ye')) value += 36;
  if (activation && name === 'Swordsoul Strategist Longyuan') value += ownField.includes('Swordsoul Grandmaster - Chixiao') ? 54 : 7;
  if (extra && name === 'Swordsoul Grandmaster - Chixiao') value += 75;
  if (extra && name === 'Monk of the Tenyi' && monsters.length > 1 && !ownHand.some(n => /Tenyi/.test(n))) value -= 110;

  if (activation && /^(EMERGENCY!|Rescue-ACE Turbulence|Rescue-ACE Quick Attacker)$/.test(name)) value += 47;
  if (action === 0 && name === 'Rescue-ACE Air Lifter' && !ownHand.includes('EMERGENCY!')) value += 38;
  if (activation && /^Salamangreat (Circle|Gazelle|Spinny|of Fire)$/.test(name)) value += 42;
  if (extra && name === 'Salamangreat Balelynx' && !own.spells.some(c => sourceName(c, cards) === 'Salamangreat Sanctuary')) value += 29;
  if (extra && name === 'Salamangreat Raging Phoenix') value += 44;
  if (activation && /^(Wishes for Eyes of Blue|Maiden of White|Roar of the Blue-Eyed Dragons)$/.test(name)) value += 46;
  if (extra && name === 'Blue-Eyes Spirit Dragon') value += 61;
  if (action === 0 && name === 'Arianna the Labrynth Servant') value += 42;
  if (activation && /^(Big Welcome Labrynth|Welcome Labrynth)$/.test(name)) value += ownField.includes('Lovely Labrynth of the Silver Castle') ? 48 : 26;

  if (state.turn === 1 && extra && /Accesscode|Knightmare Unicorn|Blue-Eyes Twin Burst/.test(name)) value -= 65;
  if (extra && endBoard.has(name)) value += 26;
  return value;
}

export function chainValue(choice, {state, player, own, enemy, cards, observations}, difficulty) {
  const active = state.chain.at(-1);
  const opposing = active && active.player !== player;
  const target = opposing ? sourceName(active, cards) : '';
  const name = sourceName(choice.card, cards);
  const threat = starterThreats.has(target) || endBoard.has(target) ? 105 : target ? 64 : 0;
  const enemyField = enemy.monsters.filter(Boolean);
  const attackEvent = observations?.attack;
  const underAttack = attackEvent?.card?.controller === (player ^ 1) && state.phase === 'Battle';
  const facingLethal = enemyField.some(card => card.position & 1 && attack(card,cards) >= state.lp[player]);

  if (name === 'Called by the Grave' || name === 'Crossout Designator') return opposing && handTraps.has(target) ? 147 : -20;
  if (name === 'Ash Blossom & Joyous Spring') return opposing ? threat : -20;
  if (name === 'Maxx "C"') return state.turnPlayer !== player && (opposing || enemyField.length || state.phase === 'Main 1') ? 111 : -20;
  if (name.startsWith('Mulcharmy ')) return state.turnPlayer !== player && (opposing || state.phase === 'Main 1' || state.phase === 'Standby') ? 89 : -20;
  if (name === 'Droll & Lock Bird' || name === 'Ghost Belle & Haunted Mansion') return state.turnPlayer !== player || opposing ? 90 : -20;
  if (dominusLocks.has(name)) {
    const attributeLock = dominusLocks.get(name);
    const breaksOwnPlays = choice.card.location === 2 && [...own.hand, ...own.monsters].some(entry => {
      const card = cards.get(entry?.code);
      return attributeLock & card?.attribute && !handTraps.has(card.name);
    });
    if (name === 'Dominus Spark') return facingLethal ? 111 : breaksOwnPlays || !enemyField.length ? -22 : opposing && starterThreats.has(target) ? 80 : 24;
    return opposing ? threat - (breaksOwnPlays ? 36 : 0) : -30;
  }
  if (name === 'Exosister Karmael' && (BigInt(choice.card.description || 0) & 0xfffffn) === 1n) return opposing ? threat + 12 : -20;
  if (name === 'Effect Veiler' || name === 'Infinite Impermanence' || name === 'Swordsoul Grandmaster - Chixiao' || name === 'Exosister Gibrine') {
    return opposing && enemyField.some(c => c.code === active.code && c.position & 5) ? threat + 18 : facingLethal && underAttack ? 87 : -20;
  }
  if (name === 'Ghost Ogre & Snow Rabbit') return opposing ? threat - 9 : -20;
  if (name === 'Nibiru, the Primal Being') return state.turnPlayer !== player && (enemyField.length >= 3 && enemyField.length > own.monsters.filter(Boolean).length || facingLethal) ? 120 : -20;
  if (name === 'Dimension Shifter') return state.turnPlayer !== player && !own.grave.length ? 91 : -20;
  if (name === 'Dimensional Barrier') return state.turnPlayer !== player && (enemyField.length >= 2 || opposing && starterThreats.has(target)) ? 82 : -20;
  if (removal.has(name) || /^(Exosister Returnia|Exosisters Magnifica|Exosister Mikailis|S:P Little Knight|CONTAIN!)$/.test(name)) {
    if (choice.card.location === 16) return 61;
    if (enemyField.length >= 2 || underAttack && facingLethal || opposing && endBoard.has(target)) return 99;
    return enemyField.length && opposing ? 61 : -13;
  }
  if (/^(Exosister Vadis|Big Welcome Labrynth|Welcome Labrynth)$/.test(name)) {
    return state.turnPlayer !== player && (opposing || enemyField.length || state.phase === 'End') ? 73 : -15;
  }
  if (name === 'Azure-Eyes Silver Dragon') return 70;
  // Leave ordinary engine-offered triggers and archetype support available.
  return opposing ? 54 : difficulty === 'beginner' ? 49 : 58;
}

export function optionValue(description, {state, player, own, cards, observations}) {
  const text = effectDescription(description, cards);
  if (/Set 1 card that mentions .*Light and Darkness Ritual/.test(text)) return state.phase === 'Battle' ? 0 : 75;
  if (text === 'Special Summon it') return observations?.drawTax?.[player ^ 1] ? 0 : 45;
  if (/Ritual Summon 1 Reptile Ritual Monster from your Deck/.test(text)) {
    const ritualInHand = own.hand.some(c => (cards.get(c.code)?.type & 0x81) === 0x81);
    return ritualInHand ? 0 : 55;
  }
  return 0;
}

export function targetValue(candidate, {own, enemy, cards, state, player, hint, observations, effect}, difficulty) {
  const name = sourceName(candidate, cards);
  const hand = own.hand.map(c => sourceName(c, cards));
  const live = (candidate.controller === player ? own : enemy).monsters[candidate.sequence];
  const boardTarget = candidate.location === 4 ? live : null;
  if (hint === 549 && observations?.battleChoice?.player === player) {
    const selected = observations.battleChoice.target;
    return candidate.sequence === selected ? 450 : -15;
  }
  if (candidate.controller !== player) {
    if (effect === 'Called by the Grave' && handTraps.has(name)) {
      const response = [...state.chain].reverse().find(link => link.player !== player && link.code === candidate.code);
      return response ? 280 : -25;
    }
    if (boardTarget) return (endBoard.has(name) ? (difficulty === 'expert' ? 91 : 62) : 20) + attack(boardTarget,cards) / 45;
    return candidate.code ? 14 : 0;
  }
  if ([500,501,511,512,513,519,531,533].includes(hint)) {
    let adjustment = endBoard.has(name) ? -105 : 0;
    if (hint === 501 && hand.filter(n => n === name).length > 1) adjustment += 55;
    if (hint === 501 && /^(Labrynth (Stovie Torbie|Chandraglier)|The White Stone|Salamangreat Spinny|Tenyi Spirit)/.test(name)) adjustment += 75;
    if (hint === 501 && handTraps.has(name) && hand.filter(n => n === name).length === 1) adjustment -= 38;
    if (hint === 500 && /Ritual/.test(effect) && candidate.location === 16) adjustment += 95;
    return adjustment;
  }
  if (hint === 506 || hint === 509 || hint === 510) {
    if (hint === 506 && hand.includes(name)) return -78;
    if (/Exosister/.test(effect)) {
      if (name === 'Exosister Returnia' && own.monsters.some(Boolean)) return 89;
      if (name === 'Exosister Martha' && !own.monsters.filter(Boolean).some(c => !(cards.get(c.code)?.type & 0x800000))) return 85;
      if (name === 'Exosister Elis' && own.monsters.some(Boolean)) return 83;
      if (name === 'Exosister Pax') return 77;
    }
    if (effect === 'Ragged Records of Rites') {
      if (name === 'Light and Darkness Ritual' && !hand.includes(name)) return 90;
      if (name === 'Ame no Habakiri no Mitsurugi' || name === 'Black Chaos') return 85;
    }
    if (/Dracotail/.test(effect) && starterThreats.has(name)) return 55;
    if (/Power Patron/.test(effect) && starterThreats.has(name)) return 50;
    if (/Elfnote/.test(effect) && starterThreats.has(name)) return 50;
    if (effect === 'Swordsoul Emergence' || effect === 'Swordsoul Grandmaster - Chixiao') {
      if (name === 'Swordsoul Blackout' && own.monsters.filter(Boolean).length >= 2 && state.turn === 1) return 86;
      if (name === 'Swordsoul of Mo Ye' && !own.monsters.some(Boolean)) return 82;
      if (name === 'Swordsoul Strategist Longyuan' && hand.some(n => /Swordsoul|Tenyi/.test(n))) return 76;
    }
    if (effect === 'EMERGENCY!' && name === 'Rescue-ACE Hydrant' && !own.monsters.some(c => sourceName(c,cards) === name)) return 90;
    if (/Labrynth/.test(effect) && name === 'Lovely Labrynth of the Silver Castle' && hint === 509) return 87;
    if (/Eyes of Blue/.test(effect) && name === 'Maiden of White') return 84;
    if (/Salamangreat/.test(effect) && name === 'Salamangreat Gazelle') return 80;
  }
  return 0;
}

// Search combat orders against the visible board. Facedown stats and possible
// responses are unknown. The actual target still comes from the next core prompt.
export function planBattle(choices, {own, enemy, cards, state, player}, depthLimit) {
  const attackers = choices.filter(choice => choice.response.action === 1).map(choice => ({
    choice, attack: attack(own.monsters[choice.card.sequence],cards),
  }));
  const defenders = enemy.monsters.flatMap((card, sequence) => card ? [{...card, sequence}] : []);
  let nodes = 0;
  const search = (remaining, targets, lp, depth) => {
    let best = {score: 0};
    if (!depth || ++nodes > 3400) return best;
    for (const attacker of remaining) {
      const unused = remaining.filter(item => item !== attacker);
      const options = targets.slice();
      if (attacker.choice.card.can_direct || !targets.length) options.push(null);
      for (const target of options) {
        if (!target) {
          const damage = attacker.attack;
          const score = damage >= lp ? 1000 + damage / 1000 : damage / 200 + search(unused, targets, lp - damage, depth - 1).score;
          if (score > best.score) best = {score, attacker, target: null};
          continue;
        }
        const defense = !!(target.position & 12);
        const strength = target.code ? (defense ? target.defense ?? cards.get(target.code)?.defense ?? 0 : attack(target,cards)) : 1700;
        if (attacker.attack < strength || (!attacker.attack && !strength) || (defense && attacker.attack === strength)) continue;
        const damage = defense ? 0 : attacker.attack - strength;
        const trade = attacker.attack === strength;
        const reward = (endBoard.has(sourceName(target,cards)) ? 18 : 8) + damage / 220 - (trade ? 9 : 0) - (!target.code ? 3 : 0);
        const score = damage >= lp ? 1000 + damage / 1000 : reward + search(unused, targets.filter(card => card !== target), lp - damage, depth - 1).score;
        if (score > best.score) best = {score, attacker, target: target.sequence};
      }
    }
    return best;
  };
  return search(attackers,defenders,state.lp[player ^ 1],Math.min(attackers.length,depthLimit));
}
