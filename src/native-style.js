import {VISUAL_STYLES} from '../lib/visual-styles.js';
// Scoped to guided-mode UI roots; model-authored canvas source is never rewritten.
const root='.dgui-root[data-preset][data-visual-style]';
export const NATIVE_STYLE_CSS=VISUAL_STYLES.map(s=>`
${root}[data-visual-style="${s.id}"]{--du-style-color:${s.preview.accent};--du-style-wash:${s.preview.bg};--du-radius:${s.id==='technical'?14:24}px;--du-radius-inner:${s.id==='technical'?10:20}px}
`).join('')+`
${root}{--du-line:color-mix(in srgb,var(--du-style-color) 24%,var(--du-bg));--du-soft:color-mix(in srgb,var(--du-style-color) 6%,var(--du-bg));--du-tint:color-mix(in srgb,var(--du-style-color) 10%,var(--du-bg));border-radius:var(--du-radius);background:var(--du-soft);border-color:var(--du-line);padding:22px;box-shadow:0 3px 12px #18253706}
${root}:not([data-accent]){--du-accent:color-mix(in srgb,var(--du-style-color) 82%,#000)}
${root} .dgui-header-title{color:var(--du-ink)}
${root} .dgui-card{background:var(--du-bg);border-radius:var(--du-radius-inner);border-color:var(--du-line);padding:20px;box-shadow:0 3px 10px #18253705}
${root} .dgui-card>.dgui-section-title{color:var(--du-accent)}
${root} .dgui-metric{background:var(--du-bg);border:1px solid var(--du-line);border-radius:var(--du-radius-inner);padding:18px 20px;gap:8px;box-shadow:0 3px 10px #18253705;--du-tone:var(--du-accent)}
${root} .dgui-metric[data-tone=success]{--du-tone:var(--du-green)}
${root} .dgui-metric[data-tone=warning]{--du-tone:var(--du-amber)}
${root} .dgui-metric[data-tone=danger]{--du-tone:var(--du-red)}
${root} .dgui-metric-label .dgui-icon{display:inline-block}
${root} .dgui-control{padding:12px 14px;border-radius:14px;background:var(--du-soft);gap:14px}
${root} .dgui-control>label{color:var(--du-ink);font-weight:550}
${root} .dgui-control output{color:var(--du-accent);background:var(--du-bg);border:1px solid var(--du-line);border-radius:10px;padding:4px 10px;min-width:58px}
${root} .dgui-control input[type=range]{accent-color:var(--du-accent)}
${root} .dgui-control input:not([type=range]):not([type=checkbox]),${root} .dgui-control select{border-radius:12px;background:var(--du-bg)}
${root} .dgui-button{background:var(--du-accent);border-color:var(--du-accent);border-radius:999px}
${root} .motion-copy-block{background:var(--du-bg);border-color:var(--du-line)}
${root} .motion-copy-block[data-code]{background:var(--du-soft)}
${root}[data-visual-style=prismframe]{box-shadow:4px 6px 0 color-mix(in srgb,var(--du-style-color) 12%,var(--du-bg));font-family:ui-rounded,var(--dsw-font-family,system-ui,sans-serif)}
${root}[data-visual-style=prismframe] .dgui-card,${root}[data-visual-style=prismframe] .dgui-metric{border:1.5px solid var(--du-line);box-shadow:3px 4px 0 color-mix(in srgb,var(--du-style-color) 11%,var(--du-bg))}
${root}[data-visual-style=technical]{box-shadow:none}
${root}[data-visual-style=technical] .dgui-card,${root}[data-visual-style=technical] .dgui-metric{box-shadow:none}
${root}[data-visual-style=expressive] .dgui-header-title{font-weight:800}
${root}[data-preset=reading],${root}[data-preset=minimal]{padding:0;border:0;background:transparent;box-shadow:none}
${root} [data-motion-component=card],${root} [data-motion-component=stat]{border:1px solid var(--du-line);border-radius:var(--du-radius-inner);background:var(--du-bg)}
${root}[data-visual-style=prismframe] [data-motion-component=card],${root}[data-visual-style=prismframe] [data-motion-component=stat]{box-shadow:3px 4px 0 color-mix(in srgb,var(--du-style-color) 11%,var(--du-bg))}
body[data-ds-dark-theme] ${root},${root}[data-preview-theme=dark]{--du-style-color:color-mix(in srgb,var(--du-style-wash) 58%,var(--du-style-color));--du-line:color-mix(in srgb,var(--du-style-color) 24%,var(--du-bg));--du-soft:color-mix(in srgb,var(--du-style-color) 8%,var(--du-bg))}
body[data-ds-dark-theme] ${root}:not([data-accent]),${root}[data-preview-theme=dark]:not([data-accent]){--du-accent:var(--du-style-color)}
@media(max-width:600px){${root}{padding:16px}${root} .dgui-card,${root} .dgui-metric{padding:16px}${root} .dgui-control{padding:10px}}
@media(forced-colors:active){${root},${root} .dgui-card,${root} .dgui-metric{box-shadow:none;border-color:CanvasText}}
`;
