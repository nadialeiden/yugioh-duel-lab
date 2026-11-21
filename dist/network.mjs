export class LocalRoom {
  constructor(onMessage){this.onMessage=onMessage;this.ws=null;this.peer=null;this.channel=null;this.transport=null;}
  async connect(){
    if(this.ws?.readyState===1)return;
    if(this.transport==='peer')return;
    const local=/^(localhost|127\.0\.0\.1|\[::1\]|(?:\d{1,3}\.){3}\d{1,3})$/.test(location.hostname);
    if(!local){await loadPeerJs();this.transport='peer';return;}
    await new Promise((resolve,reject)=>{
      const ws=this.ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/room');
      ws.onopen=()=>{this.transport='lan';resolve();};ws.onerror=()=>reject(new Error('Could not reach the LAN room server. Run npm start, then open the same LAN address on both devices.'));
      ws.onmessage=e=>{try{this.onMessage(JSON.parse(e.data));}catch(error){console.error(error);}};
      ws.onclose=()=>this.onMessage({type:'connection-closed'});
    });
  }
  send(data){
    if(this.transport==='peer'){
      if(data.type==='create'){const code=Array.from(crypto.getRandomValues(new Uint8Array(3)),v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();this.openPeer('aedu-'+code,()=>this.onMessage({type:'created',code}));return;}
      if(data.type==='join'){this.openPeer(undefined,()=>{const conn=this.peer.connect('aedu-'+data.code,{reliable:true,serialization:'json'});this.attach(conn,()=>this.onMessage({type:'joined',code:data.code}));});return;}
      if(!this.channel?.open)throw new Error('The other player is not connected yet.');this.channel.send(encode(data));return;
    }
    if(this.ws?.readyState!==1)throw new Error('Room connection is closed.');this.ws.send(encode(data));
  }
  openPeer(id,ready){
    this.peer?.destroy();this.peer=id?new window.Peer(id,{debug:0}):new window.Peer({debug:0});
    this.peer.on('open',ready);
    this.peer.on('error',error=>this.onMessage({type:'error',message:error.type==='peer-unavailable'?'Room not found. Check the code and keep the host’s Local duel tab open.':'Peer connection failed. Both players need signaling access; try the LAN server if this network blocks WebRTC.'}));
    this.peer.on('connection',conn=>{if(this.channel?.open){conn.on('open',()=>conn.close());return;}this.attach(conn,()=>this.onMessage({type:'guest-joined'}));});
  }
  attach(conn,ready){
    this.channel=conn;
    conn.on('open',ready);conn.on('data',data=>{try{if(typeof data==='string'&&data.length<=512*1024)this.onMessage(JSON.parse(data));}catch{}});
    conn.on('close',()=>this.onMessage({type:'disconnected'}));conn.on('error',()=>this.onMessage({type:'disconnected'}));
  }
  close(){this.ws?.close();this.channel?.close();this.peer?.destroy();this.ws=null;this.channel=null;this.peer=null;this.transport=null;}
}
function encode(data){return JSON.stringify(data,(_,v)=>typeof v==='bigint'?{$bigint:String(v)}:v);}
let peerJob;
function loadPeerJs(){if(window.Peer)return Promise.resolve();if(peerJob)return peerJob;peerJob=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/peerjs.min.js';s.onload=resolve;s.onerror=()=>{peerJob=null;reject(new Error('Could not load peer connections. Please try again.'));};document.head.appendChild(s);});return peerJob;}
export function revivePacket(packet){
  return JSON.parse(JSON.stringify(packet),(key,value)=>value&&typeof value==='object'&&'$bigint'in value?BigInt(value.$bigint):value);
}
