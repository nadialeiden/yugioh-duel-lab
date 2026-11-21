// Only public effect activations enter this journal. Keep the snapshots after
// CHAIN_END so a processing batch cannot erase a chain before it is painted.
export function recordChainEvent(state, message) {
  state.chain ||= [];
  state.chainEvents ||= [];
  let kind;
  const number = message.chain_size;
  if (message.type === 70) {
    state.chain.push({number, code:message.code, player:message.triggering_controller ?? message.controller,
      description:message.description, status:'activated'});
    kind = 'activate';
  } else if ([72,73,75,76].includes(message.type)) {
    const link = state.chain.find(c => c.number === number);
    if (link) {
      if (message.type === 75 || message.type === 76) link.status = 'negated';
      else if (link.status !== 'negated') link.status = message.type === 72 ? 'resolving' : 'resolved';
    }
    kind = message.type === 72 ? 'resolve' : message.type === 73 ? 'resolved' : 'negated';
  } else if (message.type === 74) {
    kind = 'end';
  } else return;
  const links = state.chain.map(link => ({...link}));
  state.chainEvents.push({id:++state.chainEventId, kind, number, links});
  if (state.chainEvents.length > 128) state.chainEvents.splice(0,state.chainEvents.length - 128);
  if (kind === 'end') state.chain = [];
}

export class ChainPlayback {
  constructor({render, onBusyChange = () => {}, timings = {activate:850,resolve:1000,resolved:180,negated:850,end:600}}) {
    Object.assign(this,{render,onBusyChange,timings});
    this.queue=[];this.seen=0;this.busy=false;this.generation=0;this.waiters=[];
  }
  update(state, viewer) {
    if (!state) { this.reset(); return; }
    if (this.duelId !== state.duelId) { this.reset(); this.duelId=state.duelId; }
    this.state=state;this.viewer=viewer;
    for (const event of state.chainEvents || []) if (event.id > this.seen) {
      this.queue.push(event);this.seen=event.id;
    }
    if (this.queue.length && !this.busy) this.play();
    else if (!this.busy && this.last) this.render(this.last,this.viewer,false,this.state);
  }
  async play() {
    const generation=this.generation;
    this.busy=true;this.onBusyChange(true);
    while (this.queue.length && generation===this.generation) {
      this.last=this.queue.shift();
      this.render(this.last,this.viewer,true,this.state);
      await new Promise(resolve => { this.release=resolve;this.timer=setTimeout(resolve,this.timings[this.last.kind] ?? 600); });
      this.release=null;
    }
    if (generation!==this.generation) return;
    this.busy=false;
    if (this.last) this.render(this.last,this.viewer,false,this.state);
    this.onBusyChange(false);
    this.waiters.splice(0).forEach(resolve=>resolve());
  }
  whenIdle() { return this.busy ? new Promise(resolve=>this.waiters.push(resolve)) : Promise.resolve(); }
  skip() {
    if (this.queue.length) this.last=this.queue.at(-1);
    this.queue=[];clearTimeout(this.timer);this.release?.();
  }
  reset() {
    this.generation++;clearTimeout(this.timer);this.release?.();this.release=null;
    this.queue=[];this.last=null;this.seen=0;this.duelId=null;this.busy=false;
    this.onBusyChange(false);this.waiters.splice(0).forEach(resolve=>resolve());
    this.render(null,0,false,null);
  }
}
