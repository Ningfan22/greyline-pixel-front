import test from 'node:test';import assert from 'node:assert/strict';
import{emplacementContact,emplacementSupports}from'../game/emplacement-ground.ts';
import{createGame,startGame,spawnUnit,tick,ground,refreshVision}from'../game/engine.ts';
import{gunPose}from'../game/gun-geometry.ts';
import{artilleryCrewPose}from'../game/artillery-crew-pose.ts';
function supports(u,terrain){return emplacementSupports(u.id).map(([x,y])=>{const dir=u.gunFacing??(u.side===0?1:-1),wx=u.x+dir*x*Math.cos(u.hullAngle)-y*Math.sin(u.hullAngle),wy=u.y+dir*x*Math.sin(u.hullAngle)+y*Math.cos(u.hullAngle);return terrain(wx)-wy;});}
for(const id of ['artillery','barrage','precision','field_gun','siege_gun','anti_tank_gun','aa_gun'])for(const side of [0,1])test(`${id} side ${side}: both original painted supports follow slopes and dips`,()=>{
 for(const terrain of [()=>374,x=>374+.18*(x-1000),x=>374-.18*(x-1000),x=>374+25*Math.sin((x-900)/120)]){
  const u={id,side,x:1000,...emplacementContact(terrain,1000,id,side?-1:1)};u.hullAngle=u.angle;assert(supports(u,terrain).every(g=>Math.abs(g)<1e-4),JSON.stringify(supports(u,terrain)));
 }
});
for(const side of [0,1])for(const moving of [false,true])test(`real artillery ${side}, moving=${moving}: supports stay grounded including tow early return and terrain changes`,()=>{
 const s=createGame(220,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});for(let i=0;i<s.terrain.length;i++)s.terrain[i]=374+27*Math.sin((i-500)/150);s.original=s.terrain.slice();s.terrainVersion++;
 spawnUnit(s,side,'artillery',1000);const u=s.units[0];Object.assign(u,{squadOrder:moving?'attack':'watch',squadOrderX:moving?(side?820:1180):1000,squadOrderUntil:Infinity,emplaced:!moving,cooldown:1e9,lane:0});const start=u.x;
 for(let i=0;i<300;i++){if(i===90){for(let j=970;j<1070;j++)s.terrain[j]+=8*Math.sin((j-970)*Math.PI/100);s.terrainVersion++;}tick(s,1/60);assert(supports(u,x=>ground(s,x)).every(g=>g>=-.01&&g<1.5),JSON.stringify(supports(u,x=>ground(s,x))));}
 assert(moving?Math.abs(u.x-start)>30:Math.abs(u.x-start)<.01);
 for(const member of [0,1]){const crew=artilleryCrewPose(u,member,s.time,x=>ground(s,x));const footY=u.y+crew.y;assert(Math.abs(footY-ground(s,u.x+crew.facing*crew.x)-3)<1e-6);}
});
for(const side of [0,1])test(`pitched artillery side ${side}: actual shell starts at the rotated painted muzzle`,()=>{
 const s=createGame(220,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});for(let i=0;i<s.terrain.length;i++)s.terrain[i]=374+.08*(i-1000);s.original=s.terrain.slice();s.terrainVersion++;
 spawnUnit(s,side,'artillery',1000);const gun=s.units[0];Object.assign(gun,{squadOrder:'watch',squadOrderX:1000,squadOrderUntil:Infinity,emplaced:true,emplacementSetupUntil:0,cooldown:0});spawnUnit(s,1-side,'tank',side?500:1500);const target=s.units[1];Object.assign(target,{squadOrder:'watch',squadOrderX:target.x,squadOrderUntil:Infinity,cooldown:1e9,secondaryCooldown:1e9});spawnUnit(s,side,'scouts',target.x+(side?40:-40));refreshVision(s);let shot;
 for(let i=0;i<600&&!shot;i++){tick(s,1/60);shot=s.projectiles.find(p=>p.sourceUid===gun.uid);}
 assert(shot,'real shot fired');const muzzle=gunPose(gun).muzzle;assert(Math.hypot(shot.startX-muzzle.x,shot.startY-muzzle.y)<1e-5);
});
