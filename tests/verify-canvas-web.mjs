import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { bicycleExample } from '../lib/canvas-example.js';
import { BUILD_INFO } from '../lib/build-info.js';
const require = createRequire(import.meta.url), { chromium } = require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const url = (await readFile(process.env.DSH_WEB_LOG, 'utf8')).match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0]; assert.ok(url);
const browser = await chromium.launch({ headless: true, channel: 'msedge' }), errors = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1200 } }); page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && m.text().includes('subscriber failed')) errors.push(m.text()); });
  await page.goto(url); await page.waitForLoadState('networkidle');
  if (process.env.DSH_CANVAS_RESUME) await page.getByText('这是 DSH Generative UI 0.5', { exact: true }).first().click();
  const document = { ...bicycleExample, title: '自由画布验收 · 自行车拆解' };
  const edit = page.locator('[contenteditable=true]').first(); if (!process.env.DSH_CANVAS_RESUME) { await edit.click();
  await page.keyboard.insertText('这是 DSH Generative UI 0.5 自由画布的验收。只用 ui_catalog 和 render_ui，不使用其他工具。先原生调用 ui_catalog，再直接原生调用 render_ui，传入下方完整 document；保持代码和状态定义。成功后只回复“交互拆解器已生成”。\n' + JSON.stringify({ document }));
  await page.keyboard.type(' '); await page.getByRole('button', { name: '发送消息', exact: true }).click(); console.log('Submitted native bicycle canvas'); }
  const ui = page.locator('[data-dsh-generative-ui]:not([data-preview=true])[aria-label="' + document.title + '"]');
  await ui.waitFor({ timeout: 240000 }); const frame = ui.frameLocator('iframe'); await frame.getByRole('button', { name: '全部', exact: true }).waitFor({ timeout: 30000 });
  assert.equal(await ui.getAttribute('data-dgui-build'),BUILD_INFO.id);
  if (process.env.DSH_CANVAS_RESUME) { await ui.getByRole('slider').fill('74'); await ui.getByText('参数已保存', { exact: true }).waitFor(); }
  await ui.getByRole('slider').fill('75'); await frame.getByText('展开观察部件如何配合', { exact: true }).waitFor();
  await frame.getByRole('button', { name: '传动', exact: true }).click(); assert.equal(await ui.getByRole('combobox').inputValue(), '3');
  await ui.getByText('参数已保存', { exact: true }).waitFor(); checks.push('real configured model native render_ui, iframe activation, SVG and state/derived bridge in installed Web');
  await ui.screenshot({ path: 'test-output/web-canvas-bicycle.png' });
  await page.setViewportSize({ width: 390, height: 844 }); const box = await ui.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 391);
  await ui.screenshot({ path: 'test-output/web-canvas-bicycle-mobile.png' });
  await page.reload(); await ui.getByText('已恢复保存的参数', { exact: true }).waitFor();
  await ui.frameLocator('iframe').getByRole('heading', { name: '传动：把踩踏变为前进', exact: true }).waitFor(); assert.equal(await ui.getByRole('slider').inputValue(), '75'); checks.push('actual Web mobile bounds and refresh restore both SVG parameters and selected explanation');
  const bicycleDocumentId = await ui.getAttribute('data-dsh-generative-ui');
  await page.setViewportSize({ width: 1365, height: 1200 });
  const creativeTitle = '自由画布验收 · 原创轨道演示';
  if (!process.env.DSH_CANVAS_RESUME) { await edit.click(); await page.keyboard.insertText('验收自由生成能力，仅使用 ui_catalog 与 render_ui，不使用其他工具。请自行设计原创 SVG 轨道动画，不复制目录样例。标题必须为“'+creativeTitle+'”。用 sandbox 节点生成 SVG、CSS 和 script，让小球围绕中心运动。标注“数学动画示意，非真实天体模拟”。document.state.speed 是 number，default=1,min=1,max=5,step=1；state.running 是 boolean,default=false。外部用标准 slider 绑定 speed、toggle 绑定 running，画布订阅 DSHUI 更新运动与明确的速度文字，停止时冻结动画。初始即显示 SVG。动画 honor prefers-reduced-motion。stateKeys 包含 speed 和 running。不要用外部资源、HTML 事件属性、Agent 动作或工具访问。成功后简短回复。');
  await page.keyboard.type(' '); await page.getByRole('button', { name: '发送消息', exact: true }).click(); console.log('Submitted model-authored original orbital SVG'); }
  const creative = page.locator('[data-dsh-generative-ui]:not([data-preview=true])[aria-label="'+creativeTitle+'"]');
  await creative.waitFor({ timeout: 240000 }); const cf = creative.frameLocator('iframe'); await cf.locator('svg').waitFor({ timeout: 30000 });
  if (process.env.DSH_CANVAS_RESUME) { await creative.getByRole('slider').fill('2'); await creative.getByRole('checkbox').uncheck(); await creative.getByText('参数已保存', { exact: true }).waitFor(); }
  await creative.getByRole('slider').fill('3'); await creative.getByRole('checkbox').check(); await creative.getByText('参数已保存', { exact: true }).waitFor();
  const handle = await creative.locator('iframe').elementHandle(), content = await handle.contentFrame();
  await content.waitForFunction(() => DSHUI.snapshot.state.speed === 3 && DSHUI.snapshot.state.running === true);
  const a = await cf.locator('svg').screenshot(); await page.waitForTimeout(150); const b = await cf.locator('svg').screenshot(); assert.ok(!a.equals(b), 'model-generated SVG actually animates');
  assert.equal(await creative.locator('.dgui-canvas-issue').count(), 0); await creative.screenshot({ path: 'test-output/web-canvas-original-orbit.png' });
  checks.push('model authors new HTML/SVG/CSS/JavaScript from a brief; native controls drive an actually moving SVG');
  await page.reload(); await creative.getByText('已恢复保存的参数', { exact: true }).waitFor(); assert.equal(await creative.getByRole('slider').inputValue(), '3'); assert.ok(await creative.getByRole('checkbox').isChecked());
  checks.push('model-authored canvas replays and restores parameters'); assert.deepEqual(errors, []);
  await writeFile('test-output/web-canvas-verification.json', JSON.stringify({ version: JSON.parse(await readFile('package.json', 'utf8')).version, checks, errors, bicycleDocumentId, creativeDocumentId: await creative.getAttribute('data-dsh-generative-ui') }, null, 2)); console.log(JSON.stringify({ checks, errors }));
} finally { await browser.close(); }
