import {VISUAL_STYLES} from '../lib/visual-styles.js';
import {STYLE_SYSTEM} from '../lib/style-system.js';
const root='.dgui-root[data-preset][data-visual-style]';
const grammar=(id,css)=>css.replaceAll('&',root+'[data-visual-style='+id+']');
// Native semantic components keep their state and reading order. Style only
// changes hierarchy, surfaces, grouping and control geometry; canvas stays authored.
export const NATIVE_STYLE_CSS=VISUAL_STYLES.map(s=>{const n=STYLE_SYSTEM[s.id].native;return `${root}[data-visual-style=${s.id}]{--du-style-base:${s.preview.accent};--du-style-color:var(--du-style-base);--du-style-wash:${s.preview.bg};--du-title-size:${n.title}px;--du-title-weight:${n.weight};--du-content-gap:${n.gap}px;--du-radius:${n.radius}px;--du-radius-inner:${n.radius-4}px;--du-metric-size:${n.metric}px;--du-feedback-ms:${n.feedback};--du-motion-gain:${n.gain}}`}).join('\n')+`
${root}{--du-style-scale:1;--du-line:color-mix(in srgb,var(--du-style-color) 24%,var(--du-bg));--du-soft:color-mix(in srgb,var(--du-style-color) 6%,var(--du-bg));--du-tint:color-mix(in srgb,var(--du-style-color) 10%,var(--du-bg));--du-motion-fill:linear-gradient(115deg,var(--du-accent),color-mix(in srgb,var(--du-accent) 65%,#202832));--du-motion-orb:var(--du-motion-fill);--du-action-radius:999px;--du-orb-radius:50%;border:1px solid var(--du-line);border-radius:var(--du-radius);background:var(--du-soft);padding:calc(24px * var(--du-style-scale));font-size:calc(16px * var(--du-style-scale));line-height:1.75;box-shadow:none;container:motion-surface / inline-size}
${root}:not([data-accent]){--du-accent:color-mix(in srgb,var(--du-style-color) 82%,#000)}
${root} .dgui-header{margin:0 0 var(--du-content-gap);padding:0;border:0;gap:12px}
${root} .dgui-header-title{color:var(--du-ink);font-size:calc(var(--du-title-size) * var(--du-style-scale));font-weight:var(--du-title-weight);line-height:1.3;letter-spacing:-.5px}
${root} .dgui-content,${root} .dgui-column{gap:calc(var(--du-content-gap) * var(--du-style-scale))}
${root} .dgui-row{gap:calc(var(--du-content-gap) * var(--du-style-scale));align-items:stretch}
${root} .dgui-section-title{font-size:calc(20px * var(--du-style-scale));font-weight:700;line-height:1.45}
${root}:not(:has(>.dgui-header))>.dgui-content>.dgui-section-title:first-child{font-size:calc(var(--du-title-size) * var(--du-style-scale));font-weight:var(--du-title-weight);line-height:1.3}
${root} .dgui-copy{font-size:inherit;line-height:1.8;color:var(--du-ink)}
${root} .dgui-card{background:var(--du-bg);border:1px solid var(--du-line);border-radius:var(--du-radius-inner);padding:calc(20px * var(--du-style-scale));gap:calc(14px * var(--du-style-scale));box-shadow:none}
${root} .dgui-card>.dgui-section-title{border:0;padding:0;font-size:calc(18px * var(--du-style-scale));color:var(--du-ink)}
${root} .dgui-metric{background:var(--du-bg);border:1px solid var(--du-line);border-radius:var(--du-radius-inner);padding:calc(18px * var(--du-style-scale));gap:7px;box-shadow:none;--du-tone:var(--du-accent)}
${root} .dgui-metric[data-tone=success]{--du-tone:var(--du-green)}${root} .dgui-metric[data-tone=warning]{--du-tone:var(--du-amber)}${root} .dgui-metric[data-tone=danger]{--du-tone:var(--du-red)}
${root} .dgui-metric strong{font-size:calc(var(--du-metric-size) * var(--du-style-scale));font-weight:760;line-height:1.15;letter-spacing:-.6px;color:var(--du-tone)}
${root} .dgui-metric-label{font-size:calc(13px * var(--du-style-scale))}${root} .dgui-metric small{font-size:calc(14px * var(--du-style-scale));letter-spacing:0}
${root} .dgui-control{border:0;padding:12px 14px;background:var(--du-soft);border-radius:14px;gap:14px}
${root} .dgui-control>label,${root} .dgui-control-label{font-size:inherit;color:var(--du-ink);font-weight:550}
${root} .dgui-control output{color:var(--du-accent);background:var(--du-bg);border:1px solid var(--du-line);border-radius:10px;padding:4px 10px;min-width:58px;font-size:inherit}
${root} .dgui-control input:not([type=range]):not([type=checkbox]),${root} .dgui-control select{border-radius:12px;background:var(--du-bg);font-size:inherit}
${root} .dgui-control input[type=range]{accent-color:var(--du-accent)}
${root} .dgui-button{border-radius:var(--du-action-radius);background:var(--du-accent);border-color:var(--du-accent)}
${root} .dgui-button[data-variant=secondary]{background:transparent;color:var(--du-ink);border-color:var(--du-line)}${root} .dgui-button[data-variant=text]{background:none;color:var(--du-accent);border-color:transparent}
${root} .dgui-steps{gap:12px;padding:0;margin:0}
${root} .dgui-steps li{position:relative;padding:14px 16px;display:flex;flex-direction:row;align-items:flex-start;text-align:left;gap:14px;border-radius:var(--du-radius-inner);background:var(--du-bg)}
${root} .dgui-steps li:before,${root} .dgui-steps li:after{display:none}${root} .dgui-step-dot{display:flex;flex:none;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;font:650 14px/1 system-ui;background:var(--du-tint);color:var(--du-tone)}
${root} .dgui-steps strong{font-size:inherit}${root} .dgui-steps p{font-size:calc(14px * var(--du-style-scale));line-height:1.7}
${root} .dgui-chart{margin:0;border-radius:var(--du-radius-inner);background:var(--du-bg);padding:16px;border:1px solid var(--du-line)}
${root} .dgui-table-wrap{border-radius:var(--du-radius-inner);background:var(--du-bg);border:1px solid var(--du-line)}${root} table{font-size:calc(14px * var(--du-style-scale))}${root} th{font-weight:650;color:var(--du-ink);background:var(--du-soft)}
${root} .motion-copy-block{border-radius:var(--du-radius-inner);background:var(--du-bg);border:1px solid var(--du-line)}${root} .motion-copy-block[data-code]{background:var(--du-soft)}
${root} .dgui-progress:not([data-tone]),${root} .dgui-progress[data-tone=neutral]{--du-tone:var(--du-accent)}
${root} [data-motion-component=card],${root} [data-motion-component=stat]{border:1px solid var(--du-line);border-radius:var(--du-radius-inner);background:var(--du-bg);box-shadow:none}
${root} [data-motion-component=stat] [class*="statValue"]{font-size:var(--du-metric-size);font-weight:var(--du-title-weight);line-height:1.15;letter-spacing:-.7px}
${root} [data-motion-component=card] [class*="cardTitle"]{font-size:20px;font-weight:var(--du-title-weight)}
${root} [data-motion-visual] [class*="block"]{--dsl-g-radius-surface:var(--du-radius-inner);--dsl-g-radius-control:var(--du-action-radius);--dsl-g-font-body:16px;--dsl-g-font-title:18px}

body[data-ds-dark-theme] ${root},${root}[data-preview-theme=dark]{--du-style-color:color-mix(in srgb,var(--du-style-wash) 58%,var(--du-style-base));--du-line:color-mix(in srgb,var(--du-style-color) 24%,var(--du-bg));--du-soft:color-mix(in srgb,var(--du-style-color) 8%,var(--du-bg))}
body[data-ds-dark-theme] ${root}:not([data-accent]),${root}[data-preview-theme=dark]:not([data-accent]){--du-accent:var(--du-style-color)}
`+grammar('editorial',`
&{background:var(--du-bg);border:0;border-radius:0;padding:16px 0;--du-motion-fill:linear-gradient(115deg,#44546a,#182537);--du-motion-orb:#44546a;--du-action-radius:10px;--du-orb-size:28px;--du-feedback-travel:18%;--du-label-ms:220ms}
& .dgui-header{border-bottom:1px solid var(--du-line);padding-bottom:16px}& .dgui-header-title,& .dgui-section-title{font-family:ui-serif,Georgia,'Noto Serif SC',serif;font-weight:650}
& .dgui-heading-icon{display:none}& .dgui-copy{max-width:72ch;line-height:1.95}
& .dgui-card{padding:12px 0 16px;border:0;border-top:1px solid var(--du-line);border-radius:0;background:transparent}
& .dgui-metric{border:0;border-left:2px solid var(--du-line);border-radius:0;padding:4px 0 4px 18px;background:var(--du-bg);gap:5px}& .dgui-metric strong{font-family:ui-serif,Georgia,serif;font-weight:600;color:var(--du-tone)}
& .dgui-control{padding:12px 0;border-radius:0;border-bottom:1px solid var(--du-line);background:transparent}& .dgui-control output{background:none;border:0;padding:0}
& .dgui-steps{border-left:1px solid var(--du-line);margin-left:15px}& .dgui-steps li{padding:4px 0 12px 20px;background:none;border-radius:0}& .dgui-step-dot{margin-left:-36px;background:var(--du-bg);border:1px solid var(--du-line);width:30px;height:30px}
& .dgui-chart{border:0;border-radius:0;background:transparent;padding:12px 0}& .dgui-table-wrap{border:0;border-top:1px solid var(--du-line);border-radius:0}& th{background:none;border-bottom:2px solid var(--du-line)}
& .motion-copy-block{border:0;border-left:2px solid var(--du-line);border-radius:0;background:transparent;padding:12px 18px}& .motion-copy-block[data-code]{background:var(--du-soft)}
& [data-motion-component=card],& [data-motion-component=stat]{border:0;border-top:1px solid var(--du-line);border-radius:0;background:transparent;box-shadow:none}
`)+grammar('soft',`
&{border:0;background:color-mix(in srgb,var(--du-style-color) 4%,var(--du-bg));border-radius:30px;--du-motion-fill:linear-gradient(115deg,#7354bd,#307f8c);--du-action-radius:18px;--du-orb-radius:14px;--du-label-ms:430ms;font-family:ui-rounded,var(--dsw-font-family,system-ui,sans-serif)}
& .dgui-header-title{font-weight:700}& .dgui-header{align-items:flex-start}& .dgui-badge{border-radius:999px;padding:5px 12px}
& .dgui-card{border:0;border-radius:28px 28px 28px 10px;background:color-mix(in srgb,var(--du-style-color) 8%,var(--du-bg));padding:22px}& .dgui-row>.dgui-card:nth-child(even){border-radius:28px 28px 10px 28px;background:color-mix(in srgb,var(--du-green) 7%,var(--du-bg))}
& .dgui-card>.dgui-section-title{align-self:flex-start;padding:4px 10px;border-radius:999px;background:var(--du-bg);font-size:calc(15px * var(--du-style-scale))}
& .dgui-metric{border:0;border-radius:24px 24px 24px 8px;background:color-mix(in srgb,var(--du-style-color) 9%,var(--du-bg));padding:20px}& .dgui-row>.dgui-metric:nth-child(even){background:color-mix(in srgb,var(--du-green) 7%,var(--du-bg))}
& .dgui-control{border:0;border-radius:20px;background:color-mix(in srgb,var(--du-style-color) 7%,var(--du-bg));padding:14px 16px}& .dgui-control output{border:0;border-radius:999px}
& .dgui-steps li{border:0;border-radius:24px 24px 24px 8px;padding:16px 20px;background:var(--du-soft)}& .dgui-step-dot{border-radius:12px;background:var(--du-bg);color:var(--du-accent)}
& .dgui-table-wrap{border:0;border-radius:24px}& th{background:var(--du-tint)}& .dgui-chart{border:0;border-radius:24px;background:var(--du-bg)}
& .motion-copy-block{border:0;border-radius:24px 24px 24px 8px;background:var(--du-soft)}& .motion-copy-bar{color:var(--du-accent)}
& [data-motion-component=card],& [data-motion-component=stat]{border:0;border-radius:24px 24px 24px 8px;background:var(--du-soft)}
`)+grammar('technical',`
&{border:1px solid var(--du-line);border-radius:10px;background:var(--du-bg);--du-motion-fill:linear-gradient(115deg,#087a93,#15506e);--du-motion-orb:#087a93;--du-action-radius:8px;--du-orb-radius:6px;--du-orb-size:30px;--du-feedback-travel:12%;--du-label-ms:180ms}
& .dgui-header{padding-bottom:14px;border-bottom:2px solid var(--du-line)}& .dgui-header-title{letter-spacing:.2px}& .dgui-heading-icon{border-radius:6px;background:none;border:1px solid var(--du-line)}
& .dgui-card{border-radius:8px;padding:16px;border:1px solid var(--du-line);background:var(--du-bg)}& .dgui-card>.dgui-section-title{font-size:calc(16px * var(--du-style-scale));padding-bottom:10px;border-bottom:1px solid var(--du-line)}
& .dgui-row:has(>.dgui-metric){gap:0;border:1px solid var(--du-line);border-radius:8px;overflow:hidden}& .dgui-row>.dgui-metric{border:0;border-right:1px solid var(--du-line);border-radius:0;padding:16px;background:var(--du-soft)}& .dgui-row>.dgui-metric:last-child{border-right:0}
& .dgui-metric strong,& .dgui-control output,& .dgui-step-dot,& td[data-numeric=true]{font-family:ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums;letter-spacing:-.5px}
& .dgui-control{border-bottom:1px solid var(--du-line);border-radius:0;padding:10px 0;background:none}& .dgui-control output{border-radius:6px;background:var(--du-soft)}& .dgui-control input:not([type=range]):not([type=checkbox]),& .dgui-control select{border-radius:6px}
& .dgui-segmented,& .dgui-segment-indicator{border-radius:6px}& .dgui-stepper{border-radius:8px;box-shadow:none}& .dgui-stepper>button{border-radius:6px}
& .dgui-steps li{background:linear-gradient(90deg,var(--du-line) 1px,transparent 1px),linear-gradient(var(--du-line) 1px,transparent 1px),var(--du-bg);background-size:24px 24px;border:1px solid var(--du-line);border-radius:8px;padding:16px}& .dgui-steps li>div{background:var(--du-bg);padding:0 4px}& .dgui-step-dot{border-radius:6px;border:1px solid var(--du-line);background:var(--du-bg)}
& .dgui-chart{border-radius:8px;padding:14px}& .dgui-table-wrap{border-radius:8px}& table{font-variant-numeric:tabular-nums}& th{border-bottom:2px solid var(--du-line);font-size:calc(13px * var(--du-style-scale))}& th,& td{border-right:1px solid var(--du-line)}& th:last-child,& td:last-child{border-right:0}
& .motion-copy-block{border-radius:8px;padding:14px 16px;box-shadow:none}& .motion-copy-bar{border-bottom:1px solid var(--du-line);padding-bottom:10px;font-family:ui-monospace,Consolas,monospace}
& [data-motion-component=card],& [data-motion-component=stat]{border-radius:8px;box-shadow:none}
@container motion-surface (min-width:640px){& .dgui-steps:not(:has(li:nth-child(5))){display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:18px}& .dgui-steps:not(:has(li:nth-child(5))) li{flex-direction:column}& .dgui-steps:not(:has(li:nth-child(5))) li:not(:last-child):after{content:'→';display:block;position:absolute;right:-17px;top:14px;color:var(--du-muted);font-size:18px}}
`)+grammar('expressive',`
&{border:0;border-radius:20px;background:var(--du-bg);--du-motion-fill:linear-gradient(115deg,#be4d29,#a66b15);--du-action-radius:14px;--du-orb-size:44px;--du-label-ms:500ms}
& .dgui-header{border-left:6px solid var(--du-accent);padding:4px 0 4px 16px}& .dgui-header-title{font-weight:850;letter-spacing:-1.3px}& .dgui-heading-icon{display:none}& .dgui-section-title{font-weight:800;letter-spacing:-.4px}
& .dgui-card{padding:24px;border:0;border-top:4px solid var(--du-accent);border-radius:4px 20px 20px 20px;background:var(--du-soft)}& .dgui-row>.dgui-card:first-child{flex-grow:1.6;background:var(--du-tint)}& .dgui-row>.dgui-card:nth-child(even){border-top-color:var(--du-ink);background:var(--du-bg);border-bottom:1px solid var(--du-line)}
& .dgui-metric{border:0;border-radius:0;padding:12px 0;background:var(--du-bg)}& .dgui-metric strong{font-weight:850;letter-spacing:-1.7px}& .dgui-row>.dgui-metric:first-child{flex-grow:1.6;border-left:5px solid var(--du-tone);padding-left:18px}& .dgui-metric-label{font-weight:650;color:var(--du-ink)}
& .dgui-control{padding:14px 0;background:none;border-radius:0;border-bottom:2px solid var(--du-line)}& .dgui-control output{border:0;background:var(--du-tint);font-size:20px;font-weight:800}
& .dgui-steps li{padding:14px 0;background:none;border-radius:0;border-bottom:1px solid var(--du-line)}& .dgui-step-dot{font-size:calc(32px * var(--du-style-scale));width:46px;height:44px;border:0;border-radius:0;background:none;color:var(--du-tone);font-weight:850}& .dgui-steps strong{font-weight:800}
& .dgui-chart{border:0;border-left:5px solid var(--du-accent);border-radius:0;background:var(--du-soft);padding:18px}& .dgui-table-wrap{border:0;border-radius:0}& th{border-bottom:3px solid var(--du-ink);background:none;color:var(--du-ink)}
& .motion-copy-block{border:0;border-top:4px solid var(--du-accent);border-radius:0 18px 18px 18px;background:var(--du-soft)}& .motion-copy-title{font-weight:750}
& [data-motion-component=card]{border:0;border-top:4px solid var(--du-accent);border-radius:4px 20px 20px 20px;background:var(--du-soft)}& [data-motion-component=stat]{border:0;border-left:4px solid var(--du-accent);border-radius:0}

@container motion-surface (min-width:640px){& .dgui-grid[data-columns="2"]:has(>.dgui-card),& .dgui-grid[data-columns="2"]:has(>.dgui-metric){grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}& .dgui-grid[data-columns="3"]:has(>.dgui-metric){grid-template-columns:minmax(0,1.5fr) repeat(2,minmax(0,1fr))}}
`)+grammar('prismframe',`
&{font-family:ui-rounded,var(--dsw-font-family,system-ui,sans-serif);box-shadow:4px 6px 0 color-mix(in srgb,var(--du-style-color) 12%,var(--du-bg));--du-motion-fill:linear-gradient(115deg,#3069d6,#168ba2);--du-action-radius:16px;--du-orb-radius:12px;--du-label-ms:340ms}
& .dgui-header-title{font-weight:780}& .dgui-card,& .dgui-metric{border:1.5px solid var(--du-line);box-shadow:3px 4px 0 color-mix(in srgb,var(--du-style-color) 13%,var(--du-bg))}& .dgui-card>.dgui-section-title{color:var(--du-accent)}
& .dgui-control{border:1px solid var(--du-line);border-radius:16px;background:var(--du-bg);padding:14px 16px}& .dgui-control output{border:0;border-radius:10px;background:var(--du-tint)}
& .dgui-steps li{border:1.5px solid var(--du-line);border-radius:18px;box-shadow:3px 4px 0 var(--du-tint);padding:16px 18px}& .dgui-step-dot{background:var(--du-tint);border-radius:10px;color:var(--du-accent)}
& .dgui-chart,& .dgui-table-wrap{border:1.5px solid var(--du-line);border-radius:20px}& .dgui-chart{box-shadow:3px 4px 0 var(--du-tint)}
& .motion-copy-block{border:1.5px solid var(--du-line);border-radius:20px;box-shadow:3px 4px 0 var(--du-tint)}
& [data-motion-component=card],& [data-motion-component=stat]{border:1.5px solid var(--du-line);box-shadow:3px 4px 0 var(--du-tint);border-radius:20px}
`)+grammar('aurora',`
&{border:1px solid var(--du-line);border-radius:28px;background:#f4f2ee;--du-ink:#16151b;--du-muted:#66616e;--du-soft:color-mix(in srgb,var(--du-muted) 6%,var(--du-bg));--du-line:color-mix(in srgb,var(--du-muted) 17%,var(--du-bg));--du-motion-fill:linear-gradient(115deg,#7051ed,#326fce 55%,#188e97);--du-motion-orb:linear-gradient(135deg,#438ef5,#25b8bd);--du-action-radius:999px;--du-label-ms:550ms;box-shadow:0 16px 32px -28px #30204d40}
& .dgui-header{margin-bottom:24px}& .dgui-header-title{letter-spacing:-.8px}& .dgui-heading-icon{border:0;border-radius:50%;background:var(--du-motion-orb);color:#fff}& .dgui-badge{border-radius:999px;padding:5px 12px}
& .dgui-card,& .dgui-metric{border-radius:24px;padding:22px;border:1px solid var(--du-line);box-shadow:0 12px 26px -20px #30204d60}& .dgui-card{background:radial-gradient(ellipse at 100% 0,color-mix(in srgb,var(--du-accent) 7%,transparent),transparent 65%),var(--du-bg)}& .dgui-metric{background:radial-gradient(ellipse at 100% 0,color-mix(in srgb,var(--du-accent) 12%,transparent),transparent 70%),var(--du-bg)}& .dgui-metric:not([data-tone]) strong{color:var(--du-ink);font-weight:780;letter-spacing:-1.3px}
& .dgui-control{background:var(--du-bg);border:1px solid var(--du-line);border-radius:22px;padding:14px 18px}& .dgui-control output{border:0;border-radius:999px;background:var(--du-soft);font-size:18px;padding:6px 14px;color:var(--du-ink)}& .dgui-control input:not([type=range]):not([type=checkbox]),& .dgui-control select{border-radius:999px;background:var(--du-soft);padding:10px 16px}
& .dgui-button[data-variant=primary]{background:var(--du-ink);border-color:var(--du-ink);color:var(--du-bg);box-shadow:0 10px 20px -14px #30204d50}
& .dgui-steps li{border:1px solid var(--du-line);padding:18px;border-radius:22px;box-shadow:0 10px 24px -22px #30204d70}& .dgui-step-dot{border-radius:50%;background:var(--du-ink);color:var(--du-bg)}
& .dgui-chart,& .dgui-table-wrap{border-radius:24px;border:1px solid var(--du-line);background:var(--du-bg);overflow:hidden}& th,& td{padding:14px 18px}
& .motion-copy-block{border-radius:24px;padding:18px 22px;box-shadow:0 12px 24px -22px #30204d70}& .motion-copy-block[data-code]{background:var(--du-soft)}& .dgui-segmented,& .dgui-segment-indicator{border-radius:999px}
& [data-motion-component=card],& [data-motion-component=stat]{border-radius:24px;padding:22px;box-shadow:0 12px 24px -20px #30204d55}
body[data-ds-dark-theme] &,&[data-preview-theme=dark]{background:var(--du-soft);--du-ink:var(--dsw-alias-label-primary,#f4f0e8);--du-muted:var(--dsw-alias-label-secondary,#bcb5c7)}
`)+`
.dgui-root[data-motion-demo]{display:flex;flex-direction:column;gap:16px}.dgui-root[data-motion-demo]>.dgui-segmented{flex:0 0 auto}
${root} .dgui-card[data-surface=featured]{border-color:var(--du-accent)}${root} .dgui-card[data-surface=soft]{background:var(--du-soft)}${root} .dgui-card[data-tone]>.dgui-section-title{color:var(--du-tone)}
${root} .dgui-steps li[data-step-status=active]{border-color:var(--du-accent)}${root} .dgui-step-dot .dgui-icon{color:inherit}
@media(max-width:600px){${root}{padding:16px}${root}[data-preset=reading],${root}[data-preset=minimal]{padding:0}${root} .dgui-card,${root} .dgui-metric{padding:16px}${root} .dgui-control{padding:10px}${root}[data-visual-style=editorial] .dgui-card{padding:12px 0}${root}[data-visual-style=expressive] .dgui-metric{padding:10px 0}${root} .dgui-row:has(>.dgui-metric){flex-wrap:wrap}}
/* Unframed presets win after every style grammar, including dark preview rules. */
${root}[data-preset=reading],${root}[data-preset=minimal]{padding:0;border:0;background:transparent;box-shadow:none}
body[data-ds-dark-theme] ${root}[data-preset=reading],body[data-ds-dark-theme] ${root}[data-preset=minimal],${root}[data-preview-theme=dark][data-preset=reading],${root}[data-preview-theme=dark][data-preset=minimal]{background:transparent}
@media(forced-colors:active){${root},${root} .dgui-card,${root} .dgui-metric,${root} .dgui-control,${root} .dgui-chart,${root} .motion-copy-block{background:Canvas;color:CanvasText;box-shadow:none;border-color:CanvasText}${root} .dgui-steps li{background:Canvas}}
`;
