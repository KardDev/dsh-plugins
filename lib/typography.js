// Small native vocabulary: no arbitrary CSS, markup or callbacks.
export const TEXT_PRESETS=Object.freeze(['reading','brief','comparison','list','callout','scorecard','flow','minimal']);
export const TYPE_FIELDS=Object.freeze(['size','weight','color','align','lineHeight']);
export const TEXT_SIZES=Object.freeze({sm:14,md:16,lg:20,xl:26,hero:36});
export const TEXT_COLORS=Object.freeze({default:'var(--du-ink)',muted:'var(--du-muted)',accent:'var(--du-accent)',success:'var(--du-green)',warning:'var(--du-amber)',danger:'var(--du-red)',violet:'var(--du-violet)'});
export function validateTypography(value,at='text'){
 const fail=message=>{throw Error(`DSH UI: ${at}.${message}`)};
 if(value.size!==undefined&&!(typeof value.size==='number'&&Number.isFinite(value.size)&&value.size>=12&&value.size<=48)&&!Object.hasOwn(TEXT_SIZES,value.size))fail('size must be 12..48 px or sm/md/lg/xl/hero');
 if(value.weight!==undefined&&![400,500,600,700,800].includes(value.weight))fail('weight must be 400/500/600/700/800');
 if(value.color!==undefined&&(typeof value.color!=='string'||!Object.hasOwn(TEXT_COLORS,value.color)&&!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.color)))fail('color must be default/muted/accent/success/warning/danger/violet or #RGB/#RRGGBB');
 if(value.align!==undefined&&!['left','center','right'].includes(value.align))fail('align must be left/center/right');
 if(value.lineHeight!==undefined&&!(typeof value.lineHeight==='number'&&value.lineHeight>=1.2&&value.lineHeight<=2.4))fail('lineHeight must be 1.2..2.4');
}
export function typographyStyle(value){
 return {fontSize:value.size===undefined?undefined:TEXT_SIZES[value.size]??value.size,fontWeight:value.weight,color:value.color===undefined?undefined:TEXT_COLORS[value.color]??value.color,textAlign:value.align,lineHeight:value.lineHeight};
}
