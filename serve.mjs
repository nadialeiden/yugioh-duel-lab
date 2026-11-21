import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {WebSocketServer} from 'ws';
import {createRoomBroker} from './server-rooms.mjs';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.zip':'application/zip','.wasm':'application/wasm','.svg':'image/svg+xml','.conf':'text/plain; charset=utf-8'};
const port=Number(process.env.PORT||4173);
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/info')return json(res,{lan:true,port});
    if(url.pathname==='/api/ae-card')return json(res,{error:'This card has no verified AE entry in the bundled pool. Refresh the AE data before using it.'},422);
    let filename=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(filename!==root&&!filename.startsWith(root+path.sep))return json(res,{error:'Not found'},404);
    const type=mime[path.extname(filename)]||'application/octet-stream';
    let compressed=false;
    if(/\bgzip\b/.test(req.headers['accept-encoding']||''))try{const [source,gz]=await Promise.all([stat(filename),stat(filename+'.gz')]);if(gz.mtimeMs>=source.mtimeMs){filename+='.gz';compressed=true;}}catch{}
    const data=await readFile(filename);
    res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache','Vary':'Accept-Encoding',...(compressed?{'Content-Encoding':'gzip'}:{})});res.end(data);
  }catch{json(res,{error:'Not found'},404);}
});
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const wss=new WebSocketServer({noServer:true,maxPayload:512*1024});
const broker=createRoomBroker();
server.on('upgrade',(req,socket,head)=>{
  try {
    const origin=new URL(req.headers.origin);
    if(origin.host!==req.headers.host||new URL(req.url,origin).pathname!=='/room')throw new Error();
    wss.handleUpgrade(req,socket,head,ws=>{broker.connect(ws);});
  }catch{socket.destroy();}
});
server.listen(port,'0.0.0.0',()=>{
  console.log('AE Duel Lab: http://localhost:'+port);
  for(const entries of Object.values(os.networkInterfaces()))for(const net of entries||[])if(net.family==='IPv4'&&!net.internal)console.log('LAN: http://'+net.address+':'+port);
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{broker.close();wss.close();server.close(()=>process.exit(0));});
