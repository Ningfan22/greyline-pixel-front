import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit} from '../game/engine.ts';
import {logisticsIndicator,pickLogisticsIndicator,drawLogisticsIndicator} from '../game/logistics-indicator.ts';
import {issueLogisticsOrder} from '../game/logistics-orders.ts';
function scene(){const s=createGame(201);startGame(s);s.units=[];spawnUnit(s,0,'tank',700);const u=s.units[0];Object.assign(u,{x:700,y:374,fuel:50});return {s,u};}
test('pixel warning and click target share positions; choosing hold leaves it clickable',()=>{
 const {s,u}=scene(),m=logisticsIndicator(u);assert(m);assert.equal(pickLogisticsIndicator(s,m.x,m.y+m.h/2),u);
 assert.equal(pickLogisticsIndicator(s,m.x+25,m.y),null);
 assert.equal(pickLogisticsIndicator(s,m.x+25,m.y,true),u);
 assert(issueLogisticsOrder(s,u.uid,'hold'));assert.equal(pickLogisticsIndicator(s,m.x,m.y),u);
 const paints=[];let color='';const ctx={save(){},restore(){},set fillStyle(c){color=c},fillRect(...r){paints.push([color,...r])}};
 drawLogisticsIndicator(ctx,u);assert(paints.some(p=>p[0]==='#ad994c'));
});
test('no enemy, casualty, airborne or fully supplied warning can intercept clicks',()=>{
 const {s,u}=scene(),m=logisticsIndicator(u);
 for(const patch of [{side:1},{hp:0},{wounded:true},{surrendered:true},{fuel:100},{rappelling:true}]){
  const copy={...u,...patch};s.units=[copy];assert.equal(logisticsIndicator(copy),null,JSON.stringify(patch));assert.equal(pickLogisticsIndicator(s,m.x,m.y),null);
 }
});
