import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { sceneExamples } from '../lib/catalog.js';
const require = createRequire(import.meta.url), { chromium } = require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const base = sceneExamples[4];
const document = { version: 1, title: '流式状态面板验收 · 演示', fallback: base.fallback, presentation: { ...base.presentation, density: 'compact' },
  state: { processed: { type: 'number', default: 72, min: 0, max: 100, step: 1 } },
  derived: { remaining: { op: 'sub', args: [{ const: 100 }, { ref: 'state.processed' }] } },
  actions: { analyze: { type: 'agent.followup', intent: '说明这份演示快照的已处理与待处理数量，不将演示描述成实际任务。', stateKeys: ['processed'] } },
  nodes: [base.nodes[0], { id: 'processed', type: 'slider', label: '演示已处理数量', bind: 'state.processed' },
    { ...base.nodes[1], children: [{ ...base.nodes[1].children[0], value: { ref: 'state.processed' } }, { ...base.nodes[1].children[1], value: { ref: 'derived.remaining' } }] },
    { ...base.nodes[2], value: { ref: 'state.processed' } }, base.nodes[3],
    { id: 'details', type: 'details', title: '快照说明', children: [{ id: 'explain', type: 'text', text: '这是交互与流式布局验收；进度和步骤均为演示数据，没有后台任务在执行。' }] },
    { id: 'followup', type: 'button', text: '解释当前演示快照', action: 'analyze' }]
};
const url = (await readFile(process.env.DSH_WEB_LOG, 'utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0]; assert.ok(url);
const browser = await chromium.launch({ headless: true, channel: 'msedge' }), errors = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1400 } }); page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && m.text().includes('subscriber failed')) errors.push(m.text()); });
  await page.goto(url); await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    window.previewSamples = []; window.previewEnabled = false;
    new MutationObserver(() => {
      const ui = document.querySelector('[data-dsh-generative-ui][data-preview=true]'); if (!ui) return;
      const ids = [...ui.querySelectorAll('[data-ui-node]')].map(n => n.dataset.uiNode);
      if ([...ui.querySelectorAll('input,select,button')].some(n => !n.disabled)) window.previewEnabled = true;
      if (!window.previewSamples.some(s => JSON.stringify(s) === JSON.stringify(ids))) window.previewSamples.push(ids);
    }).observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  const edit = page.locator('[contenteditable=true]').first(); await edit.click();
  await page.keyboard.insertText('这是 DSH Generative UI 0.4 的流式与新样式验收。只使用 ui_catalog 和 render_ui，不使用其他工具。先原生调用 ui_catalog，再直接原生调用 render_ui，参数是下方完整 document，请保持属性顺序与内容。成功后只回复“状态面板已生成”。\n' + JSON.stringify({ document }));
  await page.keyboard.type(' '); await page.getByRole('button', { name: '发送消息', exact: true }).click(); console.log('Submitted native streamed status UI');
  const ui = page.locator('[data-dsh-generative-ui]:not([data-preview=true])[aria-label="' + document.title + '"]');
  await ui.waitFor({ timeout: 180000 }); await ui.getByText('使用初始参数', { exact: true }).waitFor();
  const stream = await page.evaluate(() => ({ samples: window.previewSamples, enabled: window.previewEnabled }));
  console.log(JSON.stringify({ stream }));
  assert.ok(stream.samples.length >= 2, 'actual native stream exposes more than one completed-subtree preview'); assert.equal(stream.enabled, false);
  checks.push('real native partial-argument hook incrementally previews multiple completed subtrees with controls disabled');
  assert.equal(await ui.getAttribute('data-layout'), 'status'); assert.equal(await ui.getAttribute('data-density'), 'compact');
  assert.equal(await ui.locator('.dgui-tag').count(), 1); assert.equal(await ui.locator('.dgui-steps li').count(), 3);
  await ui.getByRole('slider').fill('80'); await ui.getByRole('progressbar').getAttribute('value').then(v => assert.equal(v, '80'));
  await ui.getByText('20 项', { exact: true }).waitFor(); await ui.getByText('参数已保存', { exact: true }).waitFor();
  await ui.getByText('快照说明', { exact: true }).click(); await ui.getByText('这是交互与流式布局验收；进度和步骤均为演示数据，没有后台任务在执行。', { exact: true }).waitFor();
  checks.push('status/compact scene, badge, dynamic progress, steps and collapsible details render in actual Web');
  await page.mouse.move(1200, 20); await ui.screenshot({ path: 'test-output/web-stream-status.png' });
  await page.setViewportSize({ width: 390, height: 844 }); const box = await ui.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 391);
  await ui.screenshot({ path: 'test-output/web-stream-status-mobile.png' }); checks.push('actual 390px status scene stays in bounds');
  await page.reload(); await ui.getByText('已恢复保存的参数', { exact: true }).waitFor(); assert.equal(await ui.getByRole('slider').inputValue(), '80'); assert.equal(await ui.getByRole('progressbar').getAttribute('value'), '80');
  checks.push('refresh replays committed document and restores progress-driving parameters');
  const buttonColor = await ui.getByRole('button', { name: '解释当前演示快照', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor);
  assert.equal(buttonColor, 'rgb(22, 123, 117)'); checks.push('actual action button uses the selected teal scene accent');
  assert.deepEqual(errors, []); const result = { version: JSON.parse(await readFile('package.json', 'utf8')).version, checks, stream, errors, documentId: await ui.getAttribute('data-dsh-generative-ui') };
  await writeFile('test-output/web-stream-verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
