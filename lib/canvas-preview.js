import { CANVAS_SYSTEM_CSS } from './canvas-system.js';
import {canvasContentHeight} from './canvas-controls.js';
import {inspectTextCards, fitTextCards} from './canvas-layout.js';
// Executed only as trusted bootstrap code inside an opaque-origin preview frame.
export function updatePreview(html) {
  const template=document.createElement('template');template.innerHTML=html;
  const tags=new Set('div main section article header footer aside nav p span strong em b i small br hr h1 h2 h3 h4 ul ol li dl dt dd figure figcaption table caption thead tbody tfoot tr th td button label input output select option textarea svg g defs marker path rect circle ellipse line polyline polygon text tspan title desc linearGradient radialGradient stop clipPath use'.toLowerCase().split(' '));
  for(const el of [...template.content.querySelectorAll('*')]){
    if(!tags.has(el.localName.toLowerCase())){el.remove();continue;}
    for(const attr of [...el.attributes]){
      const name=attr.name.toLowerCase();
      if(!/^(id|class|style|role|tabindex|type|value|min|max|step|for|disabled|checked|selected|colspan|rowspan|scope|viewbox|width|height|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|d|points|fill|fill-opacity|stroke|stroke-width|stroke-dasharray|stroke-linecap|stroke-linejoin|opacity|transform|text-anchor|dominant-baseline|font-size|font-weight|marker-end|marker-start|markerwidth|markerheight|refx|refy|orient|offset|stop-color|stop-opacity|clip-path|gradientunits|gradienttransform|preserveaspectratio|aria-[a-z-]+|data-[a-z-]+)$/.test(name))el.removeAttribute(attr.name);
    }
    if(el.matches('button,input,select,textarea'))el.setAttribute('disabled','');
  }
  function morph(parent,next){
    const desired=[...next.childNodes];
    desired.forEach((node,i)=>{
      const old=parent.childNodes[i];
      if(!old){parent.append(node.cloneNode(true));return;}
      if(old.nodeType!==node.nodeType||old.nodeName!==node.nodeName){old.replaceWith(node.cloneNode(true));return;}
      if(node.nodeType!==1){if(old.textContent!==node.textContent)old.textContent=node.textContent;return;}
      for(const attr of [...old.attributes])if(!node.hasAttribute(attr.name))old.removeAttribute(attr.name);
      for(const attr of [...node.attributes])if(old.getAttribute(attr.name)!==attr.value)old.setAttribute(attr.name,attr.value);
      morph(old,node);
    });
    while(parent.childNodes.length>desired.length)parent.lastChild.remove();
  }
  morph(document.getElementById('canvas'),template.content);
}
export function previewFrameDocument(channel,nonce){
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'nonce-${nonce}';style-src 'unsafe-inline';img-src data:;base-uri 'none';form-action 'none';frame-src 'none'"><style>${CANVAS_SYSTEM_CSS}</style><style id="custom"></style><style>#canvas,#canvas *,#canvas *::before,#canvas *::after{animation:none!important;transition:none!important}html,body{overflow:hidden}</style><main id="canvas" inert></main><script nonce="${nonce}">const inspectCards=${inspectTextCards.toString()},fitCards=${fitTextCards.toString()};const contentHeight=${canvasContentHeight.toString()};const update=${updatePreview.toString()};addEventListener('message',e=>{if(e.source!==parent||e.data?.channel!==${JSON.stringify(channel)})return;document.getElementById('custom').textContent=e.data.css;for(const [k,v] of Object.entries(e.data.theme||{}))document.documentElement.style.setProperty('--canvas-'+k,v);document.documentElement.dataset.canvasScheme=e.data.theme?.scheme||'light';update(e.data.html);fitCards(document.getElementById('canvas'),inspectCards)});new ResizeObserver(()=>parent.postMessage({channel:${JSON.stringify(channel)},previewHeight:contentHeight(document.getElementById('canvas'))},'*')).observe(document.getElementById('canvas'));</script>`;
}
