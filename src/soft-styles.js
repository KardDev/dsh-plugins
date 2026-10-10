// Unified softer defaults. Gradients stay low saturation so labels remain legible.
export const SOFT_CSS=`
.dgui-root{--du-radius:24px;--du-radius-inner:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--du-accent) 4%,var(--du-bg)),var(--du-bg) 42%,color-mix(in srgb,var(--du-violet) 3%,var(--du-bg)));border-radius:var(--du-radius)}
.dgui-root .dgui-card,.dgui-root .dgui-metric,.dgui-root .dgui-chart,.dgui-root .dgui-progress,.dgui-root .dgui-details{border-radius:var(--du-radius-inner);background:linear-gradient(135deg,color-mix(in srgb,var(--du-tone) 9%,var(--du-bg)),color-mix(in srgb,var(--du-violet) 4%,var(--du-bg)) 65%,var(--du-bg))}
.dgui-root .dgui-card[data-surface=soft]{background:linear-gradient(135deg,var(--du-soft),color-mix(in srgb,var(--du-accent) 7%,var(--du-bg)))}
.dgui-root .dgui-card[data-surface=featured]{border-radius:20px;background:linear-gradient(130deg,color-mix(in srgb,var(--du-accent) 14%,var(--du-bg)),color-mix(in srgb,var(--du-violet) 7%,var(--du-bg)));box-shadow:none}
.dgui-root[data-layout=dashboard] .dgui-metric{background:linear-gradient(135deg,color-mix(in srgb,var(--du-tone) 11%,var(--du-bg)),var(--du-bg))}
.dgui-root[data-layout=report] .dgui-card{padding:16px 18px;border:1px solid var(--du-line);border-radius:18px}
.dgui-root .dgui-heading-icon{border-radius:14px;background:linear-gradient(145deg,color-mix(in srgb,var(--du-accent) 14%,var(--du-bg)),color-mix(in srgb,var(--du-violet) 8%,var(--du-bg)))}
.dgui-root .dgui-button{border-radius:14px;background:linear-gradient(120deg,var(--du-action,#3e60d3),color-mix(in srgb,var(--du-action,#3e60d3) 85%,#152647))}
.dgui-root input:not([type=range]):not([type=checkbox]),.dgui-root select,.dgui-root textarea,.dgui-root .dgui-secondary,.dgui-root .dgui-menu-trigger{border-radius:12px}
.dgui-root .dgui-menu-content,.dgui-root .dgui-table-wrap,.dgui-root .dgui-canvas-placeholder,.dgui-root .dgui-canvas-loading,.dgui-root .dgui-canvas-issue{border-radius:18px}
.dgui-root .dgui-menu-content button{border-radius:12px}.dgui-root .dgui-badge{border-radius:999px;background:linear-gradient(120deg,var(--du-soft),var(--du-tint))}
.dgui-root .dgui-table-wrap caption{text-align:left;padding:12px 14px;font-size:14px;font-weight:600;color:var(--du-ink);background:linear-gradient(120deg,var(--du-tint),var(--du-bg))}
.dgui-root[data-layout=status] .dgui-header{border-radius:23px 23px 0 0;background:linear-gradient(120deg,var(--du-tint),var(--du-soft))}
.dgui-root[data-layout=dashboard]{background:linear-gradient(145deg,var(--du-tint),var(--du-bg) 45%,color-mix(in srgb,var(--du-violet) 4%,var(--du-bg)))}
.dgui-root .dgui-content>:last-child{margin-bottom:0}.dgui-root .dgui-canvas-stage iframe{border-radius:16px}
@media(max-width:600px){.dgui-root{--du-radius:22px;--du-radius-inner:18px}}
@media(forced-colors:active){.dgui-root,.dgui-root .dgui-card,.dgui-root .dgui-metric,.dgui-root .dgui-chart,.dgui-root .dgui-button{background:Canvas}}
`;
