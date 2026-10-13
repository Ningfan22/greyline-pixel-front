import '../app/globals.css';
import {createRoot} from 'react-dom/client';
import {CardFace} from '../game/card-art';
import {CARDS,type CardId} from '../game/cards';
import {FICTIONAL_SETTING_NOTICE} from '../game/fictional-setting';
import {useState} from 'react';
const sections:Record<string,CardId[]>={'装备名称':['tow_ifv','javelin','heavy_tank','mlrs'],'小队称谓':['marines','armed_police','militia','rangers'],'组织标记':['command_lockdown','medic_team','field_hospital','fort_medical_post']};
function Review(){const [section,setSection]=useState('装备名称');return <main style={{maxWidth:1240,margin:'auto',padding:20,color:'#e9e3c1'}}><h1>架空名称与组织标记检查 · v235</h1><p>{FICTIONAL_SETTING_NOTICE}</p><nav style={{display:'flex',gap:12,margin:'18px 0'}}>{Object.keys(sections).map(name=><button key={name} onClick={()=>setSection(name)} style={{padding:'10px 18px',background:section===name?'#68734d':'#354b38',border:'1px solid #bbc68b'}}>{name}</button>)}</nav><section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}}>{sections[section].map(id=><div key={id}><h2 style={{fontSize:18}}>{CARDS[id].name}</h2><CardFace id={id} eager className="detail-card"/></div>)}</section></main>}
createRoot(document.getElementById('root')!).render(<Review/>);
