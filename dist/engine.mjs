import createCore, {OcgDuelMode} from './vendor/ocg/index.js';
import {safeView} from './model.mjs';
import {recordChainEvent} from './chain-events.mjs';
const decisions = new Set([10,11,12,13,14,15,16,18,19,20,21,22,23,24,25,26,132,140,141,142,143]);
const phases = {1:'Draw',2:'Standby',4:'Main 1',8:'Battle',16:'Battle',32:'Damage',64:'Damage calculation',128:'Battle end',256:'Main 2',512:'End'};
export function shuffledDeck(list,seed){
  let value=seed.reduce((a,n)=>Math.imul(a^Number(BigInt(n)&0xffffffffn),16777619)>>>0,2166136261)||1;
  const random=()=>{value+=0x6D2B79F5;let n=value;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
  const out=list.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
}
export class DuelSession {
  constructor({cards,readScript,onUpdate=()=>{},onError=()=>{},seed}) {
    Object.assign(this,{cards,readScript,onUpdate,onError});
    this.seed = seed || Array.from(crypto.getRandomValues(new Uint32Array(4)),v=>BigInt(v)+1n);
    this.state = {duelId:Array.from(crypto.getRandomValues(new Uint32Array(2)),n=>n.toString(16)).join('-'),players:[],lp:[8000,8000],turn:0,turnPlayer:0,phase:'Preparing',chain:[],chainEvents:[],chainEventId:0,log:[],prompt:null,promptId:0,winner:null};
    this.history = []; this.closed = false; this.processing = false;
  }
  async start(decks) {
    this.decks = structuredClone(decks);
    this.core = await createCore({sync:true,print:()=>{},printErr:message=>console.warn(message)});
    this.handle = this.core.createDuel({flags:OcgDuelMode.MODE_MR5,seed:this.seed,
      team1:{startingLP:8000,startingDrawCount:5,drawCountPerTurn:1},team2:{startingLP:8000,startingDrawCount:5,drawCountPerTurn:1},
      cardReader:code=>{const c=this.cards.get(code); return c ? {...c,race:BigInt(c.race)} : null;},
      scriptReader:name=>this.readScript(name),
      errorHandler:(type,message)=>{ if (type===0) this.scriptError = message; }
    });
    if (!this.handle) throw new Error('The OCG engine could not create a duel.');
    for (const name of ['constant.lua','utility.lua']) {
      const script = this.readScript(name); if (!script || !this.core.loadScript(this.handle,name,script)) throw new Error('Could not initialize '+name);
    }
    // OCGCore starts from the order supplied by the caller. Shuffle each Main
    // Deck explicitly; never rely on startDuel to randomize opening hands.
    for (let player=0;player<2;player++) for (const [key,location] of [['main',1],['extra',64]]) for (const code of (location===1?shuffledDeck(decks[player][key],[...this.seed,BigInt(player+1)]):decks[player][key])) {
      this.core.duelNewCard(this.handle,{code,team:player,controller:player,duelist:0,location,position:8,sequence:0});
    }
    if (this.scriptError) throw new Error('Card script error: '+this.scriptError);
    this.core.startDuel(this.handle); this.pump();
  }
  name(code) { return this.cards.get(code)?.name || 'a card'; }
  log(text) { this.state.log.push({turn:this.state.turn,text}); if(this.state.log.length>250)this.state.log.shift(); }
  consume(m) {
    if(decisions.has(m.type)){this.state.prompt=m;this.state.promptId++;return;}
    recordChainEvent(this.state,m);
    switch(m.type) {
      case 1: this.state.prompt=this.pendingPrompt;this.rejected=new Error('The engine rejected this choice. Please choose again.');break;
      case 5: this.closed=true;this.state.winner=m.player; this.state.prompt=null; this.log(m.player<2?'Player '+(m.player+1)+' wins.':'The duel is a draw.'); break;
      case 40: this.state.turn++; this.state.turnPlayer=m.player; this.log('Turn '+this.state.turn+' · Player '+(m.player+1)); break;
      case 41: this.state.phase=phases[m.phase]||'Phase '+m.phase; break;
      case 60: case 62: case 64: this.log((m.type===62?'Special Summon: ':m.type===64?'Flip Summon: ':'Normal Summon: ')+this.name(m.code)); break;
      case 70: this.lastActivation={...m}; this.log('Chain '+m.chain_size+': '+this.name(m.code)); break;
      case 72: this.log('Resolve Chain Link '+m.chain_size); break;
      case 74: break;
      case 75: case 76: this.log('Chain Link '+m.chain_size+' negated.'); break;
      case 90: this.log('Player '+(m.player+1)+' draws '+m.drawn.length+' card(s).'); break;
      case 91: case 100: this.state.lp[m.player]=Math.max(0,this.state.lp[m.player]-m.amount); this.log('Player '+(m.player+1)+(m.type===100?' pays ':' takes ')+m.amount+' LP.'); break;
      case 92: this.state.lp[m.player]+=m.amount; break;
      case 94: this.state.lp[m.player]=m.lp; break;
      case 110: this.log('Attack declared.'); break;
      case 130: this.log('Coin: '+m.results.map(v=>v?'Heads':'Tails').join(', ')); break;
      case 131: this.log('Dice: '+m.results.join(', ')); break;
      case 164: this.log(m.hint); break;
    }
  }
  snapshot() {
    // v0.1.7's query reader does not skip the TYPE payload. Read type from
    // the card database and request only fields its public decoder supports.
    const flags=1|2|16|32|256|512|0x10000|0x20000|0x100000;
    this.state.players=[0,1].map(controller=>{
      const query=location=>this.core.duelQueryLocation(this.handle,{controller,location,flags});
      return {monsters:query(4),spells:query(8),hand:query(2),grave:query(16),banished:query(32),extra:query(64),deckCount:this.core.duelQueryCount(this.handle,controller,1)};
    });
    return this.state;
  }
  view(player) { return safeView(this.state,player); }
  pump() {
    if(this.processing||this.closed)return;
    this.processing=true;
    try {
      let iterations=0;
      while(!this.closed) {
        const result=this.core.duelProcess(this.handle);
        const messages=this.core.duelGetMessage(this.handle);
        for(const m of messages)this.consume(m);
        if(this.scriptError)throw new Error('Card script error: '+this.scriptError);
        if(result===0||this.closed){this.closed=true;break;}
        if(result===1)break;
        if(++iterations>10000)throw new Error('The engine exceeded its processing limit.');
      }
      this.snapshot(); this.onUpdate(this.state);
      if(this.rejected){const error=this.rejected;this.rejected=null;this.onError(error);}
    } catch(error){ this.onError(error); }
    finally{this.processing=false;}
  }
  respond(response,promptId=this.state.promptId,player=this.state.prompt?.player) {
    if(this.closed||this.processing||!this.state.prompt||promptId!==this.state.promptId||player!==this.state.prompt.player)return false;
    this.pendingPrompt=this.state.prompt;
    this.history.push({promptId,response:structuredClone(response)});
    this.core.duelSetResponse(this.handle,response);
    this.state.prompt=null; this.pump(); return true;
  }
  replay() { return {version:1,engine:'ocgcore-wasm@0.1.7',rules:'OCG Master Rule April 2020',seed:this.seed.map(String),decks:this.decks,responses:this.history}; }
  destroy() { this.closed=true; if(this.handle){this.core.destroyDuel(this.handle);this.handle=null;} }
}
