// Serialized into the opaque frame; it never reads host content.
export function measureVisual(root, nodeId='') {
  const issues=[],seen=new Set(),coverage={nodeId,elements:0,truncated:false,contrastChecked:0,contrastUncovered:0};
  const add=(code,value,el)=>{const id=el?.closest('[data-ui-node]')?.getAttribute('data-ui-node')??nodeId;const k=id+':'+code+':'+Math.round(value??0);if(!seen.has(k)&&issues.length<40){seen.add(k);issues.push({code,nodeId:id,...(value===undefined?{}:{value:Number(value.toFixed(2))})});}};
  const color=s=>{let m=s.match(/^rgba?\(([^)]+)\)/);if(m){const a=m[1].split(/[\s,\/]+/).map(Number);return[a[0]/255,a[1]/255,a[2]/255,a[3]??1]}m=s.match(/^color\(srgb ([^)]+)\)/);if(m){const a=m[1].split(/[\s\/]+/).map(Number);return[a[0],a[1],a[2],a[3]??1]}return null;};
  const luminance=c=>c.slice(0,3).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const widthRoot=root.id==='canvas'?document.documentElement:root;if(widthRoot.scrollWidth>widthRoot.clientWidth+2)add('overflow',widthRoot.scrollWidth-widthRoot.clientWidth);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT);let el;while((el=walker.nextNode())){if(coverage.elements>=2000){coverage.truncated=true;break}coverage.elements++;if(el.matches('[data-canvas-phase=error]'))add('runtimeError',undefined,el);
    const css=getComputedStyle(el),box=el.getBoundingClientRect();if(!box.width||!box.height||css.visibility==='hidden'||css.display==='none')continue;
    const text=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(text){let size=parseFloat(css.fontSize);if(el instanceof SVGElement&&el.getScreenCTM){const m=el.getScreenCTM();if(m)size*=Math.hypot(m.c,m.d)}if(size<11.9)add('smallText',size,el);
      const fg=color(css.color);let ancestor=el,bg=null,depth=0;while(ancestor&&depth++<64){const style=getComputedStyle(ancestor);if(style.backgroundImage!=='none')break;const c=color(style.backgroundColor);if(c?.[3]===1){bg=c;break}if(c?.[3]>0)break;ancestor=ancestor.parentElement;}
      if(!(el instanceof SVGElement)&&fg?.[3]===1&&bg){coverage.contrastChecked++;const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(ratio<(size>=24||(size>=18.66&&parseFloat(css.fontWeight)>=700)?3:4.5))add('contrast',ratio,el);}else coverage.contrastUncovered++;
    }
    if(el.matches('input:not([type=hidden]),select,textarea,button,[role=button]')&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!el.labels?.length&&!el.textContent.trim()&&!el.getAttribute('title'))add('missingLabel',undefined,el);
  }
  Object.defineProperty(issues,'coverage',{value:coverage});return issues;
}
