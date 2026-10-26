import { useCallback,useEffect,useRef,useState } from 'react';
import { verifiedProfile } from './meryo-api';

export function useIdentity(client) {
  const [profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const generation=useRef(0);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  const refresh=useCallback(async()=>{
    const version=++generation.current;setLoading(true);
    try{const next=await verifiedProfile(client);if(version===generation.current){setProfile(next);setError('');}return next;}
    catch(e){if(version===generation.current){setProfile(null);setError(e.message);}return null;}
    finally{if(version===generation.current)setLoading(false);}
  },[client]);
  useEffect(()=>{
    let timer;refresh();
    const {data:{subscription}}=client.auth.onAuthStateChange(()=>{clearTimeout(timer);generation.current++;setProfile(null);timer=setTimeout(refresh,0);});
    return()=>{invalidate();clearTimeout(timer);subscription.unsubscribe();};
  },[client,refresh,invalidate]);
  return {profile,loading,error,refresh};
}
