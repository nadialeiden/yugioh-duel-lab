import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRoomBroker} from '../server-rooms.mjs';
class Socket extends EventEmitter{constructor(){super();this.readyState=1;this.messages=[];}send(text){this.messages.push(JSON.parse(text));}close(){this.emit('close');}message(value){this.emit('message',JSON.stringify(value));}}
test('room broker limits a room to two, separates host/guest commands, and cleans disconnects',()=>{
 const b=createRoomBroker(),host=new Socket(),guest=new Socket(),third=new Socket();for(const s of [host,guest,third])b.connect(s);
 host.message({type:'create'});const code=host.messages.at(-1).code;guest.message({type:'join',code});third.message({type:'join',code});assert.equal(third.messages.at(-1).type,'error');
 guest.message({type:'state',state:{secret:1}});assert.equal(guest.messages.at(-1).type,'error');
 host.message({type:'state',state:{visible:1}});assert.deepEqual(guest.messages.at(-1).state,{visible:1});
 guest.message({type:'response',response:{type:3,yes:true}});assert.equal(host.messages.at(-1).type,'response');
 guest.close();assert.equal(host.messages.at(-1).type,'disconnected');assert.equal(b.rooms.size,0);b.close();
});
