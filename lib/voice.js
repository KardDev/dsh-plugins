import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {runMedia} from './video.js';

// Reuse an explicitly configured MiniMax credential; never copy DSH providers,
// return keys/signed URLs, or include them in an editable project.
export async function voiceConfig(){
 let saved={};try{saved=JSON.parse(await readFile(join(homedir(),'.mmx','config.json'),'utf8'))}catch{}
 return {key:process.env.MINIMAX_API_KEY||saved.api_key,region:process.env.MINIMAX_REGION||saved.region||'cn'};
}
export async function voiceCapabilities(){const c=await voiceConfig();return {configured:!!c.key,provider:'MiniMax',setup:'Configure official mmx authentication (~/.mmx/config.json), or MINIMAX_API_KEY and optional MINIMAX_REGION=cn/global. Paid API is used only when synthesize_voice is explicitly called.'}}
export function voiceTimings(raw,duration){
 const entries=Array.isArray(raw)?raw:raw?.subtitles;
 if(!Array.isArray(entries)||!entries.length)throw Error('Motion voice: provider returned no timed subtitles; audio retained');
 let previous=0;
 const captions=entries.map(e=>{
  const start=e.time_begin/1000,end=e.time_end/1000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<previous||end<=start||end>duration+.1||typeof e.text!=='string'||!e.text.trim())throw Error('Motion voice: invalid provider subtitle timing; audio retained');
  previous=end;return {start,end:Math.min(end,duration),text:e.text};
 });
 // Numerals/version strings can have several spoken syllables all pointing to
 // the SAME source word range. Merge those measured spans, not repeated text
 // at distinct source positions (e.g. a deliberately repeated phrase).
 const timed=entries.map(e=>{
  const result=[];for(const w of e.timestamped_words??[]){if(!Number.isFinite(w.time_begin)||!Number.isFinite(w.time_end)||w.time_begin<0||w.time_end<w.time_begin)throw Error('Motion voice: invalid word timing; audio retained');const p=result.at(-1);if(p&&Number.isInteger(w.word_begin)&&Number.isInteger(w.word_end)&&p.word_begin===w.word_begin&&p.word_end===w.word_end&&p.word===w.word){p.time_end=Math.max(p.time_end,w.time_end)}else result.push({...w})}return result;
 });
 const words=timed.flat().map(w=>({start:w.time_begin/1000,end:w.time_end/1000,text:w.word}));
 let last=-1;for(const w of words){if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<last||w.end<w.start||w.start<0||w.end>duration+.1||typeof w.text!=='string')throw Error('Motion voice: invalid word timing; audio retained');last=w.start}
 // The service may group a whole paragraph in one sentence entry. Split only
 // when every source character is covered by actual returned word timings.
 const clean=s=>s.replace(/\s/g,'');
 const complete=entries.every((e,i)=>timed[i].length&&clean(timed[i].map(w=>w.word).join(''))===clean(e.text));
 if(!complete)return {captions,words};
 // Provider "words" can be phonetic fragments such as M / ot / ion / U / I.
 // Restore ONLY the original sentence's whitespace after verifying complete
 // character coverage; guessing a space between Latin fragments corrupts names.
 const pieces=timed.flatMap((group,i)=>{const source=entries[i].text;let cursor=0;return group.map(w=>{const start=cursor,needed=clean(w.word).length;let consumed=0;while(cursor<source.length&&consumed<needed){if(!/\s/.test(source[cursor]))consumed++;cursor++}return source.slice(start,cursor)})});
 const readable=[];let cue;
 const flush=()=>{if(cue&&cue.end>cue.start&&cue.text.trim())readable.push({...cue,text:cue.text.trim()});cue=undefined};
 for(const [index,w] of words.entries()){
  if(!w.text.trim())continue;
  if(cue&&(w.start-cue.end>.3||[...cue.text].length>=26))flush();
  if(!cue)cue={start:w.start,end:w.end,text:''};
  cue.text+=pieces[index];cue.end=Math.min(duration,Math.max(cue.end,w.end));
  if(/[。！？；，!?;,]$/.test(w.text))flush();
 }
 flush();
 return {captions:readable,providerCaptions:captions,words};
}
export async function synthesizeVoice(studio,args,{sessionId,signal,fetchImpl=fetch,config}={}){
 if(typeof args.text!=='string'||!args.text.trim()||args.text.length>=10000)throw Error('Motion voice: text must contain 1..9999 characters');
 const voice=args.voice??'Chinese (Mandarin)_Warm_HeartedGirl',model=args.model??'speech-2.8-hd',speed=args.speed??1;
 if(typeof voice!=='string'||!voice||voice.length>200||!['speech-2.8-hd','speech-2.8-turbo'].includes(model)||!Number.isFinite(speed)||speed<.5||speed>2)throw Error('Motion voice: invalid voice/model/speed');
 const c=config??await voiceConfig();if(!c.key)throw Error('Motion voice: configure mmx authentication or MINIMAX_API_KEY first; no credential was copied from DSH');
 if(!['cn','global'].includes(c.region))throw Error('Motion voice: region must be cn or global');
 const job=await studio.job(sessionId,'voice');job.files=['narration.txt'];await writeFile(join(job.directory,'narration.txt'),args.text);await studio.save(job);
 try{
  const response=await fetchImpl(`https://api.minimax.${c.region==='cn'?'cn':'io'}/v1/t2a_v2`,{method:'POST',signal,headers:{Authorization:'Bearer '+c.key,'Content-Type':'application/json'},body:JSON.stringify({model,text:args.text,stream:false,output_format:'hex',subtitle_enable:true,subtitle_type:'word',language_boost:'auto',voice_setting:{voice_id:voice,speed,vol:1,pitch:0},audio_setting:{format:'mp3',sample_rate:32000,bitrate:128000,channel:1}})});
  if(!response.ok)throw Error('MiniMax speech HTTP '+response.status);
  const result=await response.json();if(result.base_resp?.status_code)throw Error('MiniMax speech API '+result.base_resp.status_code+': '+result.base_resp.status_msg);
  if(typeof result.data?.audio!=='string'||!/^([a-f0-9]{2})+$/i.test(result.data.audio))throw Error('MiniMax returned no valid hex audio');
  const audio=join(job.directory,'narration.mp3');await writeFile(audio,Buffer.from(result.data.audio,'hex'));job.files.push('narration.mp3');await studio.save(job);
  const probe=JSON.parse(await runMedia(process.env.DSH_MOTION_FFPROBE||'ffprobe',['-v','error','-show_format','-show_streams','-of','json',audio],{signal}));
  const duration=Number(probe.format?.duration);if(!probe.streams?.some(s=>s.codec_type==='audio')||!Number.isFinite(duration)||duration<=0)throw Error('Motion voice: returned audio failed verification');
  const url=new URL(result.data.subtitle_file);if(url.protocol!=='https:')throw Error('Motion voice: provider must supply HTTPS timed subtitles');
  const subtitles=await fetchImpl(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!subtitles.ok)throw Error('Subtitle download HTTP '+subtitles.status);
  const raw=await subtitles.json();await writeFile(join(job.directory,'subtitles.raw.json'),JSON.stringify(raw,null,2));job.files.push('subtitles.raw.json');const timings=voiceTimings(raw,duration);
  await writeFile(join(job.directory,'timings.json'),JSON.stringify(timings,null,2));
  job.files.push('timings.json');job.duration=duration;job.captions=timings.captions;job.words=timings.words;job.audioPath=audio;job.recipe={provider:'MiniMax',model,voice,speed};job.status='completed';return await studio.save(job);
 }catch(e){const message=String(e.message).replaceAll(c.key,'[REDACTED]').replace(/https?:\/\/\S+/g,'[URL]');job.status='failed';job.error=message;await studio.save(job);throw Error(message+'; retained assets: '+job.directory)}
}
