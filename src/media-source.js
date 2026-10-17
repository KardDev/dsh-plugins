import {useEffect,useState} from 'react';

// Electron's dsh-app proxy currently removes Content-Length. Chromium then
// reports MP4 seekable=[0,0], even though the Host supports HTTP byte ranges.
// A local Blob supplies a known length without exposing the Host's cookie or
// bypassing its authenticated media route. Release bytes when the film leaves.
export function useMediaSource(url){
 const native=typeof location!=='undefined'&&location.protocol==='dsh-app:';
 const [attempt,setAttempt]=useState(0),[state,setState]=useState({src:native?null:url,loading:native,error:''});
 useEffect(()=>{
  if(!native){setState({src:url,loading:false,error:''});return}
  const controller=new AbortController();let active=true,objectUrl;
  setState({src:null,loading:true,error:''});
  (async()=>{
   try{
    const response=await fetch(url,{credentials:'same-origin',signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    const blob=await response.blob();if(!active)return;
    objectUrl=URL.createObjectURL(blob);
    setState({src:objectUrl,loading:false,error:''});
   }catch(e){if(active&&e.name!=='AbortError')setState({src:null,loading:false,error:'视频未能载入，请重试。'})}
  })();
  return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[url,native,attempt]);
 return {...state,retry:()=>setAttempt(n=>n+1),native};
}
