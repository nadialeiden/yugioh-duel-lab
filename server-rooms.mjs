import {randomBytes} from 'node:crypto';
export function createRoomBroker(){
  const rooms=new Map();
  const send=(ws,data)=>{if(ws?.readyState===1)ws.send(JSON.stringify(data));};
  const leave=ws=>{
    if(!ws.room)return;const room=rooms.get(ws.room);if(!room)return;
    const other=room.host===ws?room.guest:room.host;send(other,{type:'disconnected'});
    if(other)other.room=null;rooms.delete(ws.room);ws.room=null;
  };
  const connect=ws=>{
    ws.on('message',raw=>{
      try{
        const m=JSON.parse(String(raw));
        if(m.type==='create'){
          leave(ws);if(rooms.size>=100)throw new Error('Too many open rooms.');
          let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
          rooms.set(code,{host:ws,guest:null});ws.room=code;send(ws,{type:'created',code});return;
        }
        if(m.type==='join'){
          leave(ws);const code=String(m.code||'').toUpperCase();const room=rooms.get(code);
          if(!room||room.guest)throw new Error('Room not found or already full.');
          room.guest=ws;ws.room=code;send(ws,{type:'joined',code});send(room.host,{type:'guest-joined'});return;
        }
        const room=rooms.get(ws.room);if(!room)throw new Error('Join a room first.');
        const host=room.host===ws;
        if(host&&['state','starting','rejected'].includes(m.type))send(room.guest,m);
        else if(!host&&['deck','response','surrender'].includes(m.type))send(room.host,m);
        else if(m.type==='leave')leave(ws);
        else throw new Error('Action unavailable for this player.');
      }catch(error){send(ws,{type:'error',message:error.message});}
    });
    ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
  };
  return {connect,close(){for(const room of rooms.values()){room.host.close();room.guest?.close();}rooms.clear();},rooms};
}
