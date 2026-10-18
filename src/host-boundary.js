import {STYLE_SYSTEM} from '../lib/style-system.js';

// The portal seat is transport, not another card. Protect only plugin-owned
// boundaries from generic host/skin section/div resets; never style the iframe DOM.
const root='.dgui-root[data-preset]:not(.dgui-style-preview)';
export const HOST_BOUNDARY_CSS=`
${root}{border-radius:var(--du-shell-radius,16px)!important;corner-shape:round}
`+Object.entries(STYLE_SYSTEM).map(([id,{native}])=>`${root}[data-visual-style=${id}]{--du-shell-radius:${id==='editorial'?0:id==='soft'?30:native.radius}px}`).join('\n')+`
${root}:is([data-preset=reading],[data-preset=minimal]){--du-shell-radius:0px}
.dgui-marker[data-dgui-marker]{border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;padding:0!important;min-width:0;box-sizing:border-box}
`;
