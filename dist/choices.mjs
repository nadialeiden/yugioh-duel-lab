import { decodePlaces } from './model.mjs';
export const R = {BATTLE:0, IDLE:1, EFFECT:2, YESNO:3, OPTION:4, CARD:5, CODES:6, UNSELECT:7, CHAIN:8, DISFIELD:9, PLACE:10, POSITION:11, TRIBUTE:12, COUNTER:13, SUM:14, SORT:15, RACE:16, ATTRIB:17, ANNOUNCE:18, NUMBER:19, RPS:20};
const raceNames = ['Warrior','Spellcaster','Fairy','Fiend','Zombie','Machine','Aqua','Pyro','Rock','Winged Beast','Plant','Insect','Thunder','Dragon','Beast','Beast-Warrior','Dinosaur','Fish','Sea Serpent','Reptile','Psychic','Divine-Beast','Creator God','Wyrm','Cyberse','Illusion'];
export function describePrompt(m, name = id => String(id), effect = id => String(id)) {
  const p = {title:'Choose an action', choices:[], multiple:false, min:1, max:1};
  const add = (label, response, card, detail = '') => p.choices.push({label, response, card, detail});
  const cardOptions = (list, type) => list.forEach((c,i) => add(name(c.code), {type,index:i}, c, c.description ? effect(c.description) : ''));
  if (!m) return {...p,title:'Waiting for a duel',choices:[]};
  switch (m.type) {
    case 11: {
      p.title = 'Main Phase · Choose your play';
      const groups = [['summons','Normal Summon',0],['special_summons','Special Summon',1],['pos_changes','Change position',2],['monster_sets','Set monster',3],['spell_sets','Set Spell / Trap',4],['activates','Activate',5]];
      for (const [key,label,action] of groups) (m[key] || []).forEach((c,index) => add(label, {type:R.IDLE,action,index}, c, c.description ? effect(c.description) : name(c.code)));
      if (m.to_bp) add('Enter Battle Phase',{type:R.IDLE,action:6,index:null});
      if (m.to_ep) add('End turn',{type:R.IDLE,action:7,index:null}); break;
    }
    case 10:
      p.title = 'Battle Phase · Choose your play';
      (m.chains || []).forEach((c,index) => add('Activate',{type:R.BATTLE,action:0,index},c,effect(c.description)));
      (m.attacks || []).forEach((c,index) => add('Attack',{type:R.BATTLE,action:1,index},c,c.can_direct ? 'Direct attack available' : 'Select a target next'));
      if (m.to_m2) add('Main Phase 2',{type:R.BATTLE,action:2,index:null});
      if (m.to_ep) add('End turn',{type:R.BATTLE,action:3,index:null}); break;
    case 12: case 13:
      p.title = m.type === 12 ? name(m.code) + ' · Activate effect?' : effect(m.description);
      add('Yes',{type:m.type === 12 ? R.EFFECT : R.YESNO,yes:true},m.code ? m : null,effect(m.description));
      add('No',{type:m.type === 12 ? R.EFFECT : R.YESNO,yes:false}); break;
    case 14:
      p.title = 'Choose an effect'; m.options.forEach((v,index) => add(effect(v),{type:R.OPTION,index})); break;
    case 16:
      p.title = m.forced ? 'Choose a mandatory chain effect' : 'Response window · Build the chain';
      cardOptions(m.selects,R.CHAIN); if (!m.forced) add('Pass response',{type:R.CHAIN,index:null}); break;
    case 15: case 20: case 23: {
      p.title = m.type === 20 ? 'Choose monsters to Tribute' : m.type === 23 ? 'Choose materials · required total ' + m.amount : 'Choose card(s)';
      p.multiple = true; p.min = m.min; p.max = m.max;
      p.responseType = m.type === 20 ? R.TRIBUTE : m.type === 23 ? R.SUM : R.CARD;
      (m.selects || []).forEach((c,index) => add(name(c.code),null,c,c.amount ? 'Value ' + (c.amount & 65535) : ''));
      if (m.can_cancel) p.cancel = {type:p.responseType,indicies:null};
      if (m.selects_must?.length) p.note = 'Already required: ' + m.selects_must.map(c => name(c.code)).join(', ');
      break;
    }
    case 26:
      p.title = 'Choose materials or finish selection';
      m.select_cards.forEach((c,index) => add('Select ' + name(c.code),{type:R.UNSELECT,index},c));
      m.unselect_cards.forEach((c,index) => add('Unselect ' + name(c.code),{type:R.UNSELECT,index:index + m.select_cards.length},c));
      if (m.can_finish || m.can_cancel) add(m.can_finish ? 'Finish selection' : 'Cancel',{type:R.UNSELECT,index:null}); break;
    case 18: case 24:
      p.title = m.type === 18 ? 'Choose a zone' : 'Choose zones to disable';
      p.multiple = true; p.min = p.max = m.count; p.place = true;
      decodePlaces(m.field_mask,m.player).forEach(c => add((c.player === m.player ? 'Your ' : 'Opponent’s ') + (c.location === 4 ? c.sequence >= 5 ? 'Extra Monster Zone ' : 'Monster Zone ' : c.sequence === 5 ? 'Field Zone ' : 'Spell / Trap Zone ') + (c.sequence + 1),null,c));
      p.responseType = m.type === 18 ? R.PLACE : R.DISFIELD; break;
    case 19:
      p.title = 'Choose battle position';
      [[1,'Face-up Attack'],[4,'Face-up Defense'],[8,'Face-down Defense'],[2,'Face-down Attack']].forEach(([position,label]) => { if (m.positions & position) add(label,{type:R.POSITION,position}); }); break;
    case 21: case 25:
      p.title = 'Select cards in resolution order'; p.multiple = true; p.ordered = true; p.min = p.max = m.cards.length; p.responseType = R.SORT;
      m.cards.forEach(c => add(name(c.code),null,c)); break;
    case 22:
      p.title = 'Remove ' + m.count + ' counters'; p.counter = true; p.min = p.max = m.count;
      m.cards.forEach(c => add(name(c.code),null,c,'Available: ' + c.count)); break;
    case 140: case 141: {
      p.title = 'Declare ' + (m.type === 140 ? 'Type' : 'Attribute'); p.multiple = true; p.min = p.max = m.count;
      p.responseType = m.type === 140 ? R.RACE : R.ATTRIB;
      const names = m.type === 140 ? raceNames : ['EARTH','WATER','FIRE','WIND','LIGHT','DARK','DIVINE'];
      names.forEach((label,i) => { const bit = 1n << BigInt(i); if (BigInt(m.available) & bit) add(label,null,{value:m.type === 140 ? bit : Number(bit)}); }); break;
    }
    case 142: p.title = 'Declare a card'; p.announce = true; break;
    case 143:
      p.title = 'Declare a number'; m.options.forEach(value => add(String(value),{type:R.NUMBER,value:Number(value)})); break;
    case 132:
      p.title = 'Rock, Paper, Scissors'; [[1,'Scissors'],[2,'Rock'],[3,'Paper']].forEach(([value,label])=>add(label,{type:R.RPS,value})); break;
    default: throw new Error('Unsupported decision from core: ' + m.type);
  }
  return p;
}
export function selectionValid(m, selected) {
  if (m.type !== 23) {
    if (m.type === 20) {
      const total = selected.reduce((n,i)=>n+(m.selects[i].release_param || 1),0);
      return total >= m.min && selected.length <= m.max;
    }
    return selected.length >= (m.min ?? m.count ?? m.cards?.length ?? 1) && selected.length <= (m.max ?? m.count ?? m.cards?.length ?? 1);
  }
  if (selected.length < m.min || selected.length > m.max) return false;
  const chosen = [...(m.selects_must || []),...selected.map(i=>m.selects[i])];
  let sums = new Set([0]);
  for (const c of chosen) {
    const a = c.amount & 65535, b = c.amount >>> 16;
    sums = new Set([...sums].flatMap(n=> b ? [n+a,n+b] : [n+a]));
  }
  return m.select_max ? [...sums].some(n=>n>=m.amount) : sums.has(m.amount);
}
export function selectionResponse(m, prompt, selected, counters = []) {
  if (prompt.counter) return {type:R.COUNTER,counters};
  if (prompt.place) return {type:prompt.responseType,places:selected.map(i=>prompt.choices[i].card)};
  if (prompt.ordered) return {type:R.SORT,order:selected};
  if (m.type === 140) return {type:R.RACE,races:selected.map(i=>prompt.choices[i].card.value)};
  if (m.type === 141) return {type:R.ATTRIB,attributes:selected.map(i=>prompt.choices[i].card.value)};
  // Mandatory SUM material indices precede the selectable cards in ocgcore.
  const n = m.type === 23 ? (m.selects_must?.length || 0) : 0;
  return {type:prompt.responseType,indicies:[...Array.from({length:n},(_,i)=>i),...selected.map(i=>i+n)]};
}
