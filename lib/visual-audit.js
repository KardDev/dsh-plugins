// Serialized into the opaque frame; it never reads host content.
export function measureVisual(root, nodeId='') {
  const issues=[],seen=new Set(),coverage={nodeId,elements:0,truncated:false,contrastChecked:0,contrastUncovered:0};
  const styleCache=new WeakMap(),styleOf=el=>{let css=styleCache.get(el);if(!css){css=getComputedStyle(el);styleCache.set(el,css)}return css};
  const target=el=>{if(!el)return undefined;const tag=el.tagName.toLowerCase(),id=el.id;return{selector:id&&id.length<=64?'#'+CSS.escape(id):tag,text:(el.textContent??'').trim().replace(/\s+/g,' ').slice(0,120),tag}};
  const add=(code,value,el)=>{if(issues.length>=40)return;const id=el?.closest('[data-ui-node]')?.getAttribute('data-ui-node')??nodeId;const location=target(el);const k=id+':'+code+':'+(location?.selector??'')+':'+(location?.text??'')+':'+Math.round(value??0);if(!seen.has(k)&&issues.length<40){seen.add(k);issues.push({code,nodeId:id,...(location?{target:location}:{}),...(value===undefined?{}:{value:Number(value.toFixed(2))})});}};
  const color=s=>{let m=s.match(/^rgba?\(([^)]+)\)/);if(m){const a=m[1].split(/[\s,\/]+/).map(Number);return[a[0]/255,a[1]/255,a[2]/255,a[3]??1]}m=s.match(/^color\(srgb ([^)]+)\)/);if(m){const a=m[1].split(/[\s\/]+/).map(Number);return[a[0],a[1],a[2],a[3]??1]}return null;};
  const luminance=c=>c.slice(0,3).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const blend=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3])).concat(1);
  const background=el=>{const layers=[];let n=el;for(let i=0;n&&i<64;i++,n=n.parentElement){const c=styleOf(n);if(c.backgroundImage!=='none')return null;const colorValue=color(c.backgroundColor);if(!colorValue)return null;if(colorValue[3]>0)layers.push(colorValue);if(colorValue[3]===1){let out=layers.pop();while(layers.length)out=blend(layers.pop(),out);return out;}}return null;};
  let contentBottom=root.getBoundingClientRect().top;
  const widthRoot=root.id==='canvas'?document.documentElement:root;if(widthRoot.scrollWidth>widthRoot.clientWidth+2)add('overflow',widthRoot.scrollWidth-widthRoot.clientWidth);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT);let el;while((el=walker.nextNode())){if(coverage.elements>=2000){coverage.truncated=true;break}coverage.elements++;if(el.matches('[data-canvas-phase=error]'))add('runtimeError',undefined,el);
    const css=styleOf(el),box=el.getBoundingClientRect();if(!box.width||!box.height||css.visibility==='hidden'||css.display==='none')continue;
    const text=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(text){let size=parseFloat(css.fontSize);if(el instanceof SVGElement&&el.getScreenCTM){const m=el.getScreenCTM();if(m)size*=Math.hypot(m.c,m.d)}if(size<11.9)add('smallText',size,el);
      if(!(el instanceof SVGElement)){
        const fg=color(css.color),bg=background(el);let opacitySafe=true,opacityDepth=0;for(let a=el;a;a=a.parentElement){if(++opacityDepth>64||parseFloat(styleOf(a).opacity)<1){opacitySafe=false;break}}
        if(fg&&bg&&opacitySafe){coverage.contrastChecked++;const a=luminance(blend(fg,bg)),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(ratio<(size>=24||(size>=18.66&&parseFloat(css.fontWeight)>=700)?3:4.5))add('contrast',ratio,el);}else coverage.contrastUncovered++;
        const range=document.createRange();range.selectNodeContents(el);const bounds=range.getBoundingClientRect();let a=el,depth=0;while(a&&a!==root.parentElement&&depth++<24){const c=styleOf(a),clip=a.getBoundingClientRect();if((['hidden','clip'].includes(c.overflowX)&&(bounds.left<clip.left-2||bounds.right>clip.right+2))||(['hidden','clip'].includes(c.overflowY)&&(bounds.top<clip.top-2||bounds.bottom>clip.bottom+2))){add('clippedText',undefined,el);break}a=a.parentElement}
      }else coverage.contrastUncovered++;

    }
    if(text||el.matches('svg,canvas,img,video,input,select,textarea,button'))contentBottom=Math.max(contentBottom,box.bottom);
    if(el.matches('input:not([type=hidden]),select,textarea,button,[role=button]')&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!el.labels?.length&&!el.textContent.trim()&&!el.getAttribute('title'))add('missingLabel',undefined,el);
  }
  const rect=root.getBoundingClientRect(),gap=rect.bottom-contentBottom;if(!coverage.truncated&&root.id==='canvas'&&rect.height>320&&gap>Math.max(96,rect.height*.25))add('bottomWhitespace',gap,root);
  Object.defineProperty(issues,'coverage',{value:coverage});return issues;
}
