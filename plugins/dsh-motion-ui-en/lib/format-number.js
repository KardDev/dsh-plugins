// One display rule for native metrics, text fallbacks and authored canvases.
// Keep this function self-contained: the isolated frame receives its source.
export function formatNumber(value, decimals=2) {
  if(typeof value!=='number'||!Number.isFinite(value))throw new Error('DSH UI: formatNumber requires a finite number');
  if(!Number.isInteger(decimals)||decimals<0||decimals>6)throw new Error('DSH UI: formatNumber decimals must be an integer from 0 to 6');
  return value.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
