// An untouched block reports {answers:{},locked:false}; that is the same
// state as {}, not a user edit. Avoid simultaneous inline/sidebar writes.
export function visualStateSignature(state={},defaults={}){
 const sorted=value=>Object.fromEntries(Object.entries(value??{}).sort(([a],[b])=>a.localeCompare(b)));
 return JSON.stringify({answers:sorted(state.answers),multiAnswers:sorted(state.multiAnswers),fields:sorted({...defaults,...state.fields}),locked:state.locked===true});
}
