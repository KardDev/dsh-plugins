import {STYLE_SYSTEM} from '../lib/style-system.js';

// The portal seat is transport, not another card. Protect only plugin-owned
// boundaries from generic host/skin section/div resets; never style the iframe DOM.
// Record the winning geometry from our own stylesheet, including asymmetric
// corners and intentional zeroes. This only processes trusted plugin CSS;
// model-authored iframe styles and external skins never pass through it.
export function nativeGeometryCss(css){
 // A component with no radius declaration starts at CSS's initial 0px;
 // it must not inherit the document shell's saved geometry.
 const defaults=':where(.dgui-root .dgui-card,.dgui-root .dgui-metric,.dgui-root .dgui-control,.dgui-root .dgui-chart,.dgui-root .dgui-table-wrap,.dgui-root .dgui-control input,.dgui-root .dgui-control select,.dgui-root .dgui-canvas-stage iframe){--du-component-radius:0px}\n';
 return defaults+css.replace(/border-radius\s*:\s*([^;}]+)/g,(rule,value)=>rule+';--du-component-radius:'+value.replaceAll('var(--du-radius-inner','var(--du-owned-radius-inner').replaceAll('var(--du-radius','var(--du-owned-radius'));
}
const root='.dgui-root[data-preset]:not(.dgui-style-preview)';
export const INTERNAL_BOUNDARY_CSS=`
${root} :is(.dgui-card,.dgui-metric,.dgui-control,.dgui-chart,.dgui-table-wrap){border-radius:var(--du-component-radius,16px)!important;corner-shape:round}
${root} .dgui-control :is(input:not([type=range]):not([type=checkbox]),select){border-radius:var(--du-component-radius,12px)!important;corner-shape:round}
${root} .dgui-canvas-stage iframe{border-radius:var(--du-component-radius,16px)!important;corner-shape:round}
`;
export const HOST_BOUNDARY_CSS=`
${root}{--du-owned-radius:16px;--du-owned-radius-inner:12px;border-radius:var(--du-shell-radius,16px)!important;corner-shape:round}
`+Object.entries(STYLE_SYSTEM).map(([id,{native}])=>`${root}[data-visual-style=${id}]{--du-shell-radius:${id==='editorial'?0:id==='soft'?30:native.radius}px;--du-owned-radius:${native.radius}px;--du-owned-radius-inner:${native.radius-4}px}`).join('\n')+`
`+INTERNAL_BOUNDARY_CSS+`
${root}:is([data-preset=reading],[data-preset=minimal]){--du-shell-radius:0px}
.dgui-marker[data-dgui-marker]{border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;padding:0!important;min-width:0;box-sizing:border-box}
`;
