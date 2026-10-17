import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const MOTION_DESIGN_REFERENCE=Object.freeze({
 id:'motion-design',name:'Motion Design — complete OpenDesign skill',
 source:'https://github.com/nexu-io/open-design/tree/14fee234e6eb268058fed17ba979d8e22798dd34/skills/motion-design',
 usage:'ui_catalog({topic:"motion",scene:"motion-design"}) or ui_catalog({topic:"video",scene:"promo"}) loads the complete original skill and separate DSH adapter on demand.'
});

// No source body is read or injected at import/registration time.
export async function loadMotionDesignSkill(){
 const base=new URL('../skills/motion-design/',import.meta.url);
 const [raw,adapter,provenance,sources]=await Promise.all([
  readFile(new URL('SKILL.md',base)),readFile(new URL('ADAPTER.md',base),'utf8'),
  readFile(new URL('upstream.json',base),'utf8'),readFile(new URL('SOURCES.md',base),'utf8')
 ]);
 const metadata=JSON.parse(provenance.replace(/^\uFEFF/,''));
 const sha256=createHash('sha256').update(raw).digest('hex');
 if(sha256!==metadata.sha256)throw Error('Motion UI: bundled motion-design skill integrity mismatch; restore the complete packaged skill.');
 return {...MOTION_DESIGN_REFERENCE,complete:true,modified:false,license:'Apache-2.0',
  original:raw.toString('utf8'),sources,provenance:{...metadata,sha256},adapter,
  precedence:'Current user requirements and the DSH adapter govern host execution; apply the full upstream design craft.'};
}
