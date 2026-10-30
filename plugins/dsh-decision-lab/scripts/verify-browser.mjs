import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const generated = spawnSync(process.execPath, ['scripts/demo.mjs'], { cwd: root, encoding: 'utf8' });
assert.equal(generated.status, 0, generated.stderr || generated.stdout);
const artifacts = resolve(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(artifacts, 'decision-lab-demo.html')).href);
  const leader = page.getByTestId('leader');
  await leader.waitFor();
  assert.equal(await leader.textContent(), 'Fast launch');
  const change = async (label, value) => page.getByRole('slider', { name: `${label} weight` }).evaluate((node, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(node, String(v)); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await change('Speed', 0);
  await page.waitForFunction(() => document.querySelector('[data-testid="leader"]').textContent === 'Careful pilot');
  assert.match(await page.locator('.ddl-session-note').textContent(), /Unsaved scenario/);
  await change('Confidence', 0);
  assert.match(await page.getByRole('alert').textContent(), /positive/);
  assert.equal(await leader.textContent(), 'Careful pilot');
  assert.equal(await page.getByRole('slider', { name: 'Confidence weight' }).inputValue(), '30');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  assert.equal(await leader.textContent(), 'Fast launch');
  assert.equal(await page.getByRole('alert').count(), 0);
  await page.getByRole('slider', { name: 'Speed weight' }).focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.getByRole('slider', { name: 'Speed weight' }).inputValue(), '69.9');
  await change('Speed', 0);
  for (const [button, extension] of [['Export JSON', 'json'], ['Export Markdown', 'md']]) {
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: button, exact: true }).click();
    const download = await event;
    assert.equal(download.suggestedFilename(), `decision-lab.${extension}`);
    const data = await readFile(await download.path(), 'utf8');
    if (extension === 'json') {
      const saved = JSON.parse(data);
      assert.deepEqual(saved.analysis.leaders, ['pilot']);
      assert.equal(saved.weights.speed, 0);
      assert.equal(saved.decision.criteria[0].weight, 70, 'original input retained');
    } else assert.match(data, /Careful pilot/);
  }
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.screenshot({ path: resolve(artifacts, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
  await page.screenshot({ path: resolve(artifacts, 'mobile.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: resolve(artifacts, 'dark.png'), fullPage: true });
  // DSH exposes bg-layer-1, not the demo-only bg-primary token. Reproduce its
  // dark host without supplying a synthetic brand color that masks fallbacks.
  await page.addStyleTag({ content: 'body{--dsw-alias-bg-primary:initial;--dsw-alias-brand-primary:initial;--dsw-alias-bg-layer-1:#202020;--dsw-alias-label-primary:#f5f5f5;--dsw-alias-label-secondary:#c0c0c0}' });
  const nativeTheme = await page.locator('.ddl').evaluate(card => {
    const style = getComputedStyle(card);
    const contrast = foreground => {
      const luminance = color => {
        const values = color.match(/[0-9.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const a = luminance(foreground), b = luminance(style.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    return { background: style.backgroundColor, textContrast: contrast(style.color), mutedContrast: contrast(getComputedStyle(card.querySelector('.ddl-muted')).color), controlContrast: contrast(getComputedStyle(card.querySelector('.ddl-text-button')).color) };
  });
  assert.equal(nativeTheme.background, 'rgb(32, 32, 32)', 'use the actual DSH surface token');
  assert.ok(nativeTheme.textContrast >= 4.5, 'native dark text stays readable');
  assert.ok(nativeTheme.mutedContrast >= 4.5, 'native dark secondary text stays readable');
  assert.ok(nativeTheme.controlContrast >= 4.5, 'native dark reset/accent fallback stays readable');
  await page.screenshot({ path: resolve(artifacts, 'native-dark.png'), fullPage: true });

  await change('Speed', 0);
  await page.reload();
  assert.equal(await leader.textContent(), 'Fast launch', 'reload restores original metadata');
  await page.evaluate(() => window.__labRender({ phase: 'result', block: { content: [{ type: 'text', text: '<script>throw Error("injected")</script>' }], meta: { decisionLab: { version: 99 } } } }));
  await page.getByText('Decision Lab: text result (no compatible card data).').waitFor();
  assert.equal(await page.locator('.ddl').count(), 0);
  await page.evaluate(() => window.__labRender({ phase: 'result', block: { isError: true, content: [{ type: 'text', text: 'Bad input' }] } }));
  assert.match(await page.getByRole('alert').textContent(), /Bad input/);
  await page.evaluate(() => window.__labRender({ phase: 'start', block: {} }));
  assert.match(await page.getByRole('status').textContent(), /Preparing/);
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(JSON.stringify({ passed: true, checks: ['real host registry payload', 'packaged module/slot adapter', 'slider changes winner', 'all-zero rejection', 'reset', 'keyboard', 'JSON export', 'Markdown export', '375px overflow', 'light/dark screenshots', 'native DSH dark surface and text/control contrast', 'reload replay', 'malformed metadata fallback', 'tool error', 'pending', 'no page errors'], hostApplication: 'not exercised; demo slot adapter' }));
  await context.close();
} finally { await browser.close(); }
