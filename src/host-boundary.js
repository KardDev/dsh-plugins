import {STYLE_SYSTEM} from '../lib/style-system.js';

// Include secondary native surfaces as well as the large containers. Keep this
// scoped to renderer-owned elements; never blanket-reset the conversation DOM.
const surfaces=[
 '.dgui-card','.dgui-metric','.dgui-control','.dgui-chart','.dgui-table-wrap',
 '.dgui-steps li','.dgui-step-dot','.dgui-copy','.dgui-header','.dgui-heading-icon',
 '.dgui-badge','.dgui-tag','.dgui-details','.dgui-progress','.dgui-progress progress',
 '.dgui-button','.dgui-secondary','.dgui-toggle','.dgui-control output',
 '.dgui-control input:not([type=range]):not([type=checkbox])','.dgui-control select',
 '.dgui-root textarea','.dgui-root pre','.dgui-plot','.dgui-menu-trigger',
 '.dgui-menu-content','.dgui-menu-content button','.dgui-canvas-loading',
 '.dgui-canvas-spinner','.dgui-canvas-placeholder','.dgui-canvas-issue',
 '.dgui-canvas-stage iframe','.dgui-version-preview','.dgui-segmented',
 '.dgui-segment-indicator','.dgui-segmented button','.dgui-action-orb',
 '.dgui-elastic','.dgui-stepper','.dgui-stepper>button',
 '.dgui-card>.dgui-section-title','.dgui-row:has(>.dgui-metric)',
 '.motion-copy-block','.motion-copy-button',
 '[data-motion-component=card]','[data-motion-component=stat]',
];
const descendants=surfaces.map(s=>s.replace(/^\.dgui-root /,'')).join(',');

// The portal seat is transport, not another card. Protect only plugin-owned
// boundaries from generic host/skin section/div resets; never style the iframe DOM.
// Record the winning geometry from our own stylesheet, including asymmetric
// corners and intentional zeroes. This only processes trusted plugin CSS;
// model-authored iframe styles and external skins never pass through it.
export function nativeGeometryCss(css){
 // A component with no radius declaration starts at CSS's initial 0px;
 // it must not inherit the document shell's saved geometry.
 const defaults=`:where(.dgui-root :is(${descendants})){--du-component-radius:0px}\n.dgui-toggle::before{--du-component-radius:0px}\n`;
 return defaults+recordNativeGeometry(css);
}
// Lazy native styles must record their own geometry too, so free-mode copy
// blocks keep their desktop/mobile radii instead of inheriting a card's token.
export function recordNativeGeometry(css){
 return css.replace(/border-radius\s*:\s*([^;}]+)/g,(rule,value)=>rule+';--du-component-radius:'+value.replaceAll('var(--du-radius-inner','var(--du-owned-radius-inner').replaceAll('var(--du-radius','var(--du-owned-radius'));
}
const root='.dgui-root[data-preset]:not(.dgui-style-preview)';
export const INTERNAL_BOUNDARY_CSS=`
${root} :is(${descendants}){border-radius:var(--du-component-radius,0px)!important;corner-shape:round}
${root} .dgui-toggle::before{border-radius:var(--du-component-radius,50%)!important;corner-shape:round}
`;
export const HOST_BOUNDARY_CSS=`
${root}{--du-owned-radius:16px;--du-owned-radius-inner:12px;border-radius:var(--du-shell-radius,16px)!important;corner-shape:round}
`+Object.entries(STYLE_SYSTEM).map(([id,{native}])=>`${root}[data-visual-style=${id}]{--du-shell-radius:${id==='editorial'?0:id==='soft'?30:native.radius}px;--du-owned-radius:${native.radius}px;--du-owned-radius-inner:${native.radius-4}px}`).join('\n')+`
`+INTERNAL_BOUNDARY_CSS+`
${root}:is([data-preset=reading],[data-preset=minimal]){--du-shell-radius:0px}
.dgui-marker[data-dgui-marker]{border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;padding:0!important;min-width:0;box-sizing:border-box}
`;
