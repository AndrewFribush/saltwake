import React,{useState} from 'react';
import {Workbench} from './Workbench';
import {Demo} from './Demo';
import {Run} from './Run';
export function App(){const [demo,setDemo]=useState(false);const [craft,setCraft]=useState(false);return <main><header><span className="eyebrow">DUNGEON ECONOMY / PLAYABLE PROTOTYPE</span><h1>The cellar below</h1><p>Explore the dark. Find a weapon. Decide what you dare to carry deeper.</p></header><nav><button onClick={()=>{setDemo(false);setCraft(false);}}>Free practice</button><button onClick={()=>{setDemo(true);setCraft(false);}}>Local economy demo</button><button onClick={()=>{setCraft(true);setDemo(false);}}>Crafting practice</button></nav>{craft?<Workbench/>:demo?<Demo/>:<Run/>}<footer>Practice uses simulated items. Local economy demo uses sandbox credits and saves runs on the server.</footer></main>;}
