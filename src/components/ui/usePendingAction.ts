'use client';
import { useRef, useState } from 'react';
export function usePendingAction(onError: (message: string) => void) {
 const lock=useRef(false);const [pending,setPending]=useState(false);
 async function run(action:()=>void|Promise<void>) {
  if(lock.current)return;lock.current=true;setPending(true);
  try {await new Promise(resolve=>setTimeout(resolve,300));await action();}
  catch(error){onError(error instanceof Error?error.message:'Proses gagal. Silakan coba kembali.');}
  finally{lock.current=false;setPending(false);}
 }
 return {pending,run};
}
