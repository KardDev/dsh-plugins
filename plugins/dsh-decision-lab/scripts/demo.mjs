import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import Tools from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import * as plugin from '../index.js';
import { buildClient } from './build.mjs';
import { fixture } from '../tests/fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(process.argv[2] || resolve(root, 'artifacts/decision-lab-demo.html'));
const ctx = new Context();
let result;
try {
  await ctx.plugin(SystemPrompt); await ctx.plugin(Tools); await ctx.plugin(plugin);
  result = await ctx.tools.execute({ name: 'decision_lab', callId: 'demo', arguments: { decision: fixture() }, signal: new AbortController().signal });
  if (result.isError) throw Error(JSON.stringify(result));
} finally { await ctx.fiber.dispose(); }
await buildClient(resolve(root, 'src/client.jsx'), resolve(root, 'client.js'));
const harness = await build({ entryPoints: [resolve(root, 'scripts/demo-client.jsx')], bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' } });
const script = `${harness.outputFiles[0].text}\n${await readFile(resolve(root, 'client.js'), 'utf8')}`.replace(/<\/script/gi, '<\\/script');
const data = JSON.stringify({ phase: 'result', block: { id: 'demo', ...result } }).replace(/</g, '\\u003c');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Decision Lab — interactive demo</title><style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:28px;color:#18231f;background:#f4f6f3}main{max-width:960px}main>p{font-size:13px;color:#53645b}h1{font-size:18px}@media(prefers-color-scheme:dark){body{color:#e0e9e4;background:#151b18;--dsw-alias-label-primary:#e0e9e4;--dsw-alias-label-secondary:#afbeb5;--dsw-alias-bg-layer-1:#1c2520;--dsw-alias-border-l3:#39473e;--dsw-alias-brand-primary:#76d8a7}main>p{color:#afbeb5}}@media(max-width:600px){body{padding:12px}}</style><main><h1>Decision Lab / working plugin demo</h1><p>Fictional inputs. This uses the packaged client and a result from the real DSH tool registry; the surrounding slot service is a demo adapter, not the full DSH application.</p><div id="root"></div></main><script type="application/json" id="fixture">${data}</script><script>${script}</script></html>`;
await mkdir(dirname(out), { recursive: true });
await writeFile(out, html);
console.log(JSON.stringify({ demo: out, hostRegistry: 'real', clientSlot: 'demo adapter', result: result.value.analysis.leaders }));
