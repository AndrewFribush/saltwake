import React from 'react';

export type WalletOnboardingProps = {
 accountId?: string; network: string; contractId: string;
 connected: boolean; authenticated: boolean; busy: boolean; error?: string;
 onLogin?: ()=>void; onRegister?: ()=>void; onRefresh?: ()=>void; onLogout?: ()=>void;
};
/** Uses the existing stage frame; onboarding adds no town/service shortcuts. */
export function WalletOnboarding(p:WalletOnboardingProps){
 return <section className="game-shell">
  <div className="player-hud"><strong>Saltwake</strong><span>Wallet session</span></div>
  <div className="game-notice" role="status"><p>{p.busy?'Waiting for your wallet or confirmation…':p.error??'Local sandbox · synthetic game coins'}</p></div>
  <div className="game-stage">
   <section className="arrival" style={{inset:0,overflowY:'auto',overflowWrap:'anywhere'}} aria-label="Wallet onboarding">
    <h1>Enter Saltwake</h1><p>{p.network} · {p.contractId}</p>
    {p.accountId&&<p>Account: {p.accountId}</p>}
    {!p.connected?<p>No connected wallet adapter is available. Connect through the host wallet integration to continue.</p>:!p.authenticated?<>
     <p>Sign in to bind this session to your account. Signing in does not authorize spending or register a player.</p>
     <button disabled={p.busy} onClick={p.onLogin}>Sign in with wallet</button>
    </>:<>
     <p>Your account is signed in. Register a player separately to enter the local economy. New players receive no starting coins or goods.</p>
     <button disabled={p.busy} onClick={p.onRegister}>Register player with wallet</button>
     <button disabled={p.busy} onClick={p.onRefresh}>Check registration</button>
    </>}
    {p.authenticated&&<button disabled={p.busy} onClick={p.onLogout}>Sign out</button>}
   </section>
  </div>
 </section>;
}
