// Uses the configured DSH model for two UI-only tasks. Requires an already-running Web host.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { calculatorExample, comparisonExample } from '../lib/catalog.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const url = (await readFile(process.env.DSH_WEB_LOG, 'utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0];
if (!url) throw new Error('Web URL not ready');
await mkdir('test-output', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const result = { errors: [], requests: [], checks: [] };
let page;
try {
  page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/api')) {
      const body = request.postData() ?? '';
      if (body.includes('UI 参数快照')) result.requests.push({ containsCurrentBits8: /\\?"bits\\?":\s*8/.test(body), containsViewSession: body.includes('viewedSessionId') });
    }
  });
  await page.goto(url); await page.waitForLoadState('networkidle');
  const continuation = page.getByRole('button', { name: '继续', exact: true });
  if (await continuation.isVisible()) await continuation.click();
  const edit = page.locator('[contenteditable=true]').first();
  const prompt = `这是智能UI插件验收，仅使用 ui_catalog 和 render_ui，不调用文件、Shell、网络或其他工具。先调用 ui_catalog，再原生直接调用 render_ui，参数为下面完整 document，不要改写示例。成功后只说“UI已生成”。后续用户点击按钮时只核对参数快照并简短回答，不再调用任何工具。\n${JSON.stringify({ document: calculatorExample })}`;
  if (process.env.DSH_RESUME_UI) { await page.getByText('理论权重体积计算器UI验收', { exact: true }).first().click(); } else { await edit.click(); await page.keyboard.insertText(prompt); await page.keyboard.type(' ');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  console.log('Submitted calculator generation task'); }
  const ui = page.locator('[data-dsh-generative-ui]').first();
  await ui.waitFor({ timeout: 180000 });
  await ui.getByText(/使用初始参数|已恢复保存的参数/).waitFor({ timeout: 30000 });
  if (!process.env.DSH_RESUME_UI) assert.match(await ui.innerText(), /12\.57/);
  result.checks.push('real-model tool generation and native renderer');
  const slider = ui.getByRole('slider');
  await slider.fill('4'); await slider.dispatchEvent('input'); await slider.dispatchEvent('change');
  await ui.getByText('12.57 GiB', {exact:true}).waitFor();
  await slider.fill('8'); await slider.dispatchEvent('input'); await slider.dispatchEvent('change');
  await ui.getByText(/25\.15/).waitFor();
  await ui.getByText('参数已保存', { exact: true }).waitFor({ timeout: 10000 });
  result.checks.push('slider local calculation and Host save');
  const firstId = await ui.getAttribute('data-dsh-generative-ui');
  await page.screenshot({ path: 'test-output/calculator-desktop.png', fullPage: true });
  const sessionUrl = page.url();
  await page.reload();
  await ui.getByText('已恢复保存的参数', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(await ui.getByRole('slider').inputValue(), '8'); assert.match(await ui.innerText(), /25\.15/);
  result.checks.push('refresh restores edited state');
  await ui.getByRole('button', { name: '按当前参数继续分析', exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('已加入当前会话队列') || document.body.innerText.includes('bits'), null, { timeout: 30000 });
  assert.ok(result.requests.some(r => r.containsCurrentBits8 && r.containsViewSession));
  result.checks.push('follow-up admitted with current state and viewed-session provenance');
  // Wait for the short follow-up turn to finish before asking for a second UI.
  await page.waitForFunction(() => !document.querySelector('button[aria-label="停止生成"]'), null, { timeout: 120000 });
  await edit.click(); await page.keyboard.insertText(`继续验收：仅原生直接调用 render_ui，document 使用下面示例，不使用其他工具。成功后只回复“比较UI已生成”。\n${JSON.stringify({ document: comparisonExample })}`); await page.keyboard.type(' ');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.locator('[data-dsh-generative-ui]').nth(1).waitFor({ timeout: 180000 });
  const comparison = page.locator('[data-dsh-generative-ui]').nth(1);
  await comparison.getByRole('img').waitFor();
  await comparison.getByText('图表数据', { exact: true }).click();
  assert.match(await comparison.innerText(), /18/); result.checks.push('real-model chart/table generation');
  await page.screenshot({ path: 'test-output/comparison-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-output/mobile.png', fullPage: true });
  const widths = await page.locator('[data-dsh-generative-ui]').evaluateAll(nodes => nodes.map(n => ({ width: n.getBoundingClientRect().width, left: n.getBoundingClientRect().left, right: n.getBoundingClientRect().right })));
  assert.ok(widths.every(n => n.left >= -1 && n.right <= 391)); result.checks.push('390px responsive layout');
  const unauth = await browser.newContext();
  const denied = await unauth.request.get('http://127.0.0.1:3080/api/plugins/dsh-generative-ui/state?documentId=' + firstId + '&sessionId=test');
  assert.equal(denied.status(), 401); await unauth.close(); result.checks.push('unauthenticated state access rejected');
  result.sessionUrl = sessionUrl; result.documentId = firstId;
  assert.deepEqual(result.errors, []);
  await writeFile('test-output/web-smoke-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (e) {
  if (page) { await page.screenshot({ path: 'test-output/failure.png', fullPage: true }); console.log(JSON.stringify({ failure: e.message, errors: result.errors, text: (await page.locator('body').innerText()).slice(-7000) })); }
  throw e;
} finally { await browser.close(); }


