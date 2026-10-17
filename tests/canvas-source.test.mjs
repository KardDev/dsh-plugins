import test from'node:test';import assert from'node:assert/strict';import{normalizeCanvasHtml,normalizeCanvasCss,canvasSource}from'../lib/canvas-source.js';
test('escaped formatting separators recover HTML and CSS without rewriting author code',()=>{
 assert.equal(normalizeCanvasHtml('<div>x</div>\\n<div>y</div>'),'<div>x</div>\n<div>y</div>');
 for(const text of ['<pre>\\n</pre>','<code>\\n</code>','<script>const x=">\\n<";</script>','<div title="a>\\n<b">text \\n sample</div>','<!-- \\n -->'])assert.equal(normalizeCanvasHtml(text),text);
 const css='*{box-sizing:border-box}\\n#frame{width:100%;height:100%}\\n#bar{display:flex}';assert.equal(normalizeCanvasCss(css),css.replaceAll('\\n','\n'));
 for(const text of ['.a{content:"};\\nfoo"}',String.raw`.icon\\name{color:red}`,String.raw`/* };\n */ .a{color:red}`])assert.equal(normalizeCanvasCss(text),text);
 const node={html:'<b>x</b>\\n<i>y</i>',css,script:String.raw`const text="\n";`};assert.equal(canvasSource(node).script,node.script);assert.ok(node.html.includes('\\n'));
});
