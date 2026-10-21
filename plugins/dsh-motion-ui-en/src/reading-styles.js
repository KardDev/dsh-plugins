// Editorial native UI: quiet surfaces, readable text, independent per-document presets.
export const READING_CSS=`
.dgui-root[data-preset]{--du-radius:16px;--du-radius-inner:12px;--du-tone:var(--du-ink);font-size:16px;line-height:1.75;padding:18px;margin:16px 0;border:1px solid var(--du-line);border-radius:16px;background:var(--du-bg);box-shadow:none;color:var(--du-ink)}
.dgui-root[data-preset] .dgui-header{border:0;margin:0 0 18px;padding:0;background:none;border-radius:0}
.dgui-root[data-preset] .dgui-header-title{font-size:21px;font-weight:700;line-height:1.45;letter-spacing:0}
.dgui-root[data-preset] .dgui-content,.dgui-root[data-preset] .dgui-column{gap:18px}
.dgui-root[data-preset] .dgui-copy{font-size:16px;line-height:1.8;color:var(--du-ink);overflow-wrap:anywhere}
.dgui-root[data-preset] .dgui-section-title{font-size:20px;font-weight:700;line-height:1.5;letter-spacing:0}
.dgui-root[data-preset] .dgui-row{gap:28px}.dgui-root[data-preset] .dgui-row>*{flex-basis:220px}
.dgui-root[data-preset] .dgui-grid{display:grid;grid-template-columns:repeat(var(--du-columns),minmax(0,1fr))}
.dgui-root[data-preset] .dgui-card{padding:18px;border:1px solid var(--du-line);border-radius:12px;background:transparent;box-shadow:none;gap:14px}
.dgui-root[data-preset] .dgui-card>.dgui-section-title{border:0;padding:0;font-size:18px}
.dgui-root[data-preset] .dgui-card[data-surface=soft]{background:var(--du-soft)}
.dgui-root[data-preset] .dgui-card[data-surface=featured]{border-color:var(--du-accent);background:color-mix(in srgb,var(--du-accent) 5%,var(--du-bg))}
.dgui-root[data-preset] .dgui-metric{padding:8px 0;border:0;background:none;border-radius:0;gap:5px;box-shadow:none}
.dgui-root[data-preset] .dgui-metric-label{font-size:14px}.dgui-root[data-preset] .dgui-metric-label .dgui-icon{display:none}
.dgui-root[data-preset] .dgui-metric strong{font-size:30px;line-height:1.35;font-weight:750;letter-spacing:0;color:var(--du-tone)}
.dgui-root[data-preset] .dgui-metric small{font-size:15px}
.dgui-root[data-preset] .dgui-button{font:inherit;font-size:16px;border-radius:999px;min-height:44px;padding:8px 20px;text-decoration:none;box-shadow:none;background:var(--du-ink);color:var(--du-bg);border:1px solid var(--du-ink);flex:0 1 auto;max-width:100%;white-space:normal;overflow-wrap:anywhere;cursor:pointer}
.dgui-root[data-preset] .dgui-button:hover:not(:disabled){box-shadow:none;filter:none;opacity:.8}
.dgui-root[data-preset] .dgui-button[data-variant=secondary]{background:transparent;color:var(--du-ink);border-color:var(--du-line)}
.dgui-root[data-preset] .dgui-button[data-variant=text]{background:none;border-color:transparent;color:var(--du-accent);padding:6px 0;border-radius:4px}
.dgui-root[data-preset] .dgui-control{padding:8px 0;border:0}.dgui-root[data-preset] .dgui-control>label{font-size:16px;color:var(--du-ink)}
.dgui-root[data-preset] .dgui-control>label .dgui-icon{display:none}.dgui-root[data-preset] .dgui-control output{border:0;background:none;color:var(--du-ink);font-size:19px;padding:0;font-weight:700}
.dgui-root[data-preset] .dgui-control input[type=range]{height:30px;accent-color:var(--du-ink)}
.dgui-root[data-preset] .dgui-control input:not([type=range]):not([type=checkbox]),.dgui-root[data-preset] .dgui-control select{font-size:16px;border-radius:10px}
.dgui-root[data-preset] .dgui-progress{border:0;background:none;padding:0;gap:10px}.dgui-root[data-preset] .dgui-progress-label{font-size:16px}
.dgui-root[data-preset] .dgui-progress small{font-size:14px}.dgui-root[data-preset] .dgui-progress progress{height:10px}
.dgui-root[data-preset] .dgui-steps strong{font-size:17px}.dgui-root[data-preset] .dgui-steps p{font-size:16px;color:var(--du-ink);line-height:1.8}
.dgui-root[data-preset] .dgui-chart{background:none;border:0;box-shadow:none;padding:8px 0}
.dgui-root[data-preset] table{font-size:15px}.dgui-root[data-preset] .dgui-chart figcaption{font-size:16px}
.dgui-root[data-preset] .dgui-copy[data-tone]:not([data-tone=neutral]){background:none;border:0;border-radius:0;padding:0}
.dgui-root[data-preset] .dgui-copy[data-tone]>.dgui-icon{color:var(--du-tone)}
.dgui-root[data-preset] .dgui-copy.dgui-callout{border:0;border-left:3px solid var(--du-accent);background:var(--du-soft);border-radius:0 10px 10px 0;padding:12px 16px}
.dgui-root[data-preset] section>.dgui-section-title+.dgui-steps{margin-top:16px}
.dgui-root[data-preset] .dgui-divider{display:flex;align-items:center;gap:12px;min-height:1px;color:var(--du-muted);font-size:14px}.dgui-root[data-preset] .dgui-divider:before,.dgui-root[data-preset] .dgui-divider:after{content:'';height:1px;background:var(--du-line);flex:1}.dgui-root[data-preset] .dgui-divider:empty:after{display:none}
.dgui-root[data-preset=reading],.dgui-root[data-preset=minimal]{padding:0;border:0;border-radius:0;background:transparent}
.dgui-root[data-preset=minimal] .dgui-content{gap:10px}.dgui-root[data-preset=minimal] .dgui-header{margin-bottom:12px}
.dgui-root[data-preset=comparison] .dgui-card{padding:4px 12px;border:0;background:none;border-radius:0}
.dgui-root[data-preset=list] .dgui-card{border:0;border-bottom:1px solid var(--du-line);border-radius:0;padding:4px 0 18px;background:none}.dgui-root[data-preset=list] .dgui-card:last-child{border-bottom:0;padding-bottom:0}
.dgui-root[data-preset=callout]{border:0;border-left:3px solid var(--du-accent);border-radius:0 12px 12px 0;background:color-mix(in srgb,var(--du-accent) 5%,var(--du-bg));padding:16px 20px}
.dgui-root[data-preset=scorecard]{border:0;padding:0;background:none}.dgui-root[data-preset=scorecard] .dgui-metric{flex-direction:row;align-items:baseline;justify-content:space-between;gap:24px}.dgui-root[data-preset=scorecard] .dgui-metric-label{font-size:17px;font-weight:650;color:var(--du-ink)}.dgui-root[data-preset=scorecard] .dgui-metric strong{font-size:25px}
.dgui-root[data-preset=flow] .dgui-steps li{flex-direction:column;align-items:center;text-align:center;padding-bottom:30px}.dgui-root[data-preset=flow] .dgui-step-dot{display:none}.dgui-root[data-preset=flow] .dgui-steps li:before{display:none}.dgui-root[data-preset=flow] .dgui-steps li:not(:last-child):after{content:'↓';color:var(--du-muted);position:absolute;bottom:3px}.dgui-root[data-preset=flow] .dgui-steps li:last-child{padding-bottom:0}
@media(max-width:600px){.dgui-root[data-preset]{padding:16px}.dgui-root[data-preset=reading],.dgui-root[data-preset=minimal],.dgui-root[data-preset=scorecard]{padding:0}.dgui-root[data-preset] .dgui-grid{grid-template-columns:1fr}.dgui-root[data-preset] .dgui-row{gap:18px}}
@media(forced-colors:active){.dgui-root[data-preset] .dgui-button{background:ButtonFace;color:ButtonText;border-color:ButtonText}}
`;
