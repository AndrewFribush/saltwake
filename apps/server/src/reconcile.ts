/** Every caller waits for a pass started after its request, without starving
 * earlier callers when fresh requests keep arriving. Background polls just join. */
export function reconciler(pass:()=>Promise<void>){
 let running:Promise<void>|undefined;
 const pending:{resolve:()=>void;reject:(error:unknown)=>void}[]=[];
 return (requestAnotherPass=true)=>{
  if(!requestAnotherPass&&running)return running;
  const result=new Promise<void>((resolve,reject)=>pending.push({resolve,reject}));
  if(!running)running=Promise.resolve().then(async()=>{
   try{
    while(pending.length){
     const batch=pending.splice(0);
     try{await pass();for(const waiter of batch)waiter.resolve();}
     catch(error){for(const waiter of batch)waiter.reject(error);}
    }
   }finally{running=undefined;}
  });
  return result;
 };
}
