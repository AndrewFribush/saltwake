import React,{createContext,useContext,useRef,useState} from 'react';
import {buyInDeposit,nearLabel,MAX_COINS_PER_PURCHASE} from '../../../packages/shared/src/buy-in';

/** Supplied by the wallet shell when the deployed contract offers the NEAR buy-in; absent in demo mode. */
export type BuyIn={buy:(requestId:string,coins:number)=>Promise<void>;refresh:()=>Promise<void>};
export const BuyInContext=createContext<BuyIn|null>(null);
export const useBuyIn=()=>useContext(BuyInContext);

/** Buy game coins with NEAR at the published rate. The wallet shows the exact NEAR amount before signing. */
export function BuyCoins({suggest,compact=false}:{suggest?:number;compact?:boolean}){
 const buyIn=useBuyIn();
 const [coins,setCoins]=useState(()=>Math.min(MAX_COINS_PER_PURCHASE,Math.max(1,suggest??10)));
 const [working,setWorking]=useState(false),[notice,setNotice]=useState('');
 // One request id per intended purchase, reused on retry so a repeat can never credit twice.
 const pending=useRef<{id:string;coins:number}|null>(null);
 if(!buyIn)return null;
 const valid=Number.isSafeInteger(coins)&&coins>=1&&coins<=MAX_COINS_PER_PURCHASE;
 const buy=async()=>{if(working||!valid)return;setWorking(true);setNotice('');
  if(!pending.current||pending.current.coins!==coins)pending.current={id:'buy-'+crypto.randomUUID().replaceAll('-','').slice(0,24),coins};
  try{await buyIn.buy(pending.current.id,coins);pending.current=null;await buyIn.refresh();setNotice(`Bought ${coins} coins.`);}
  catch(e){setNotice((e as Error).message+(pending.current?' · Retrying uses the same request, so you cannot be charged twice.':''));}
  finally{setWorking(false);}};
 return <div className={`buy-coins ${compact?'compact':''}`}>
  {!compact&&<h3>Buy coins with NEAR</h3>}
  <div className="buy-row">{[10,25,50].map(n=><button type="button" key={n} aria-pressed={coins===n} disabled={working} onClick={()=>setCoins(n)}>{n}</button>)}
   <label>Coins <input type="number" min="1" max={MAX_COINS_PER_PURCHASE} value={coins} disabled={working} onChange={e=>setCoins(Number(e.target.value))}/></label></div>
  <button type="button" className="primary" disabled={working||!valid} onClick={()=>void buy()}>{working?'Waiting for your wallet…':valid?`Buy ${coins} coins for ${nearLabel(buyInDeposit(coins))}`:'Choose 1–1000 coins'}</button>
  <p className="trade-note">Rate: 0.01 NEAR per coin. Your wallet shows the exact amount before you sign; the NEAR goes to the game treasury.</p>
  {notice&&<p role="status" className="buy-notice">{notice}</p>}
 </div>;
}
