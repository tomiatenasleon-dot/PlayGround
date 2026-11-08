import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const root = process.cwd();
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json' };
const server = http.createServer(async (req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
  try { const body = await readFile(file); res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}); res.end(body); }
  catch { res.writeHead(404); res.end('Not found'); }
});
const wss = new WebSocketServer({ server });
const rooms = new Map();
const send = (ws,data) => { if (ws.readyState === 1) ws.send(JSON.stringify(data)); };
function broadcast(room,data,except) { for (const peer of rooms.get(room)?.values() || []) if(peer !== except) send(peer,data); }
wss.on('connection', ws => {
  ws.id = Math.random().toString(36).slice(2,8).toUpperCase(); ws.room = null;
  send(ws,{type:'hello',id:ws.id});
  ws.on('message', raw => {
    let msg; try { msg=JSON.parse(raw); } catch { return; }
    if(msg.type === 'create' || msg.type === 'join') {
      const code = msg.type === 'create' ? Math.random().toString(36).slice(2,6).toUpperCase() : String(msg.code || '').toUpperCase().slice(0,8);
      if(!code) return send(ws,{type:'error',message:'Introduce un código de sala.'});
      if(!rooms.has(code)) rooms.set(code,new Map()); const room=rooms.get(code);
      if(room.size >= 4) return send(ws,{type:'error',message:'La sala está completa (máximo 4).'});
      ws.room=code; room.set(ws.id,ws);
      send(ws,{type:'joined',code,id:ws.id,players:[...room.keys()]}); broadcast(code,{type:'player-joined',id:ws.id},ws);
    } else if(msg.type === 'state' && ws.room) {
      const safe={type:'state',id:ws.id,x:Number(msg.x)||0,y:Number(msg.y)||0,z:Number(msg.z)||0,rot:Number(msg.rot)||0,anim:msg.anim==='run'?'run':'walk',outfit:msg.outfit==='civil'?'civil':'prison'};
      broadcast(ws.room,safe,ws);
    } else if(msg.type === 'action' && ws.room) broadcast(ws.room,{type:'action',id:ws.id,action:String(msg.action||'').slice(0,80)},ws);
  });
  ws.on('close',()=>{ if(ws.room){ const room=rooms.get(ws.room); room?.delete(ws.id); broadcast(ws.room,{type:'player-left',id:ws.id}); if(!room?.size) rooms.delete(ws.room); } });
});
const port=Number(process.env.PORT)||3002; server.listen(port,'0.0.0.0',()=>console.log(`BUSCADOS listo en http://0.0.0.0:${port}`));
