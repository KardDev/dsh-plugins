import React,{useState} from 'react';
const h=React.createElement;
export function VideoCapabilities(){
 const[report,setReport]=useState(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const check=async()=>{setBusy(true);setError('');try{const r=await fetch('/api/plugins/dsh-generative-ui/media-capabilities',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('视频环境检查失败：HTTP '+r.status);setReport(await r.json())}catch(e){setError(e.message)}finally{setBusy(false)}};
 return h('section',{'aria-label':'视频制作环境'},h('h4',null,'视频制作'),h('p',null,'可以让模型制作可编辑动效并导出 MP4，也能检查、截取和拼接本地视频，添加配音、多轨配乐与定时字幕。普通 UI 不会自动导出视频。'),h('button',{type:'button',className:'dgui-secondary',disabled:busy,onClick:check},busy?'正在检查…':'检查视频环境'),report&&h(React.Fragment,null,h('p',{role:'status'},'浏览器：'+(report.browser?'可用':'缺失')+' · FFmpeg：'+(report.ffmpeg?'可用':'缺失')+' · FFprobe：'+(report.ffprobe?'可用':'缺失')),h('p',null,'配音：'+(report.voice?.configured?'MiniMax 已配置':'未配置')+'。配音会调用付费 API；使用官方 mmx 认证或 MINIMAX_API_KEY，不复制 DSH 模型密钥。'),(!report.browser||!report.ffmpeg||!report.ffprobe)&&h('p',null,'需要本机 Chrome/Edge 或 Chromium，以及 FFmpeg/FFprobe。可用 DSH_MOTION_BROWSER、DSH_MOTION_FFMPEG、DSH_MOTION_FFPROBE 配置路径；不会自动下载大型运行时。')),error&&h('p',{role:'alert'},error));
}
