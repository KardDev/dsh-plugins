import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DSH_PLAYWRIGHT ?? 'playwright');
const log = await readFile(process.env.DSH_WEB_LOG, 'utf8');
const url = log.match(/http:\/\/127\.0\.0\.1:3080\/\S*/)?.[0];
if (!url) throw new Error('Authenticated web URL not ready');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const errors = []; page.on('console', m => { if(m.type()==='error'||m.type()==='warning') console.log(m.text().slice(0,2000)); }); page.on('response', r=> {if(r.status()>=400) console.log(r.status(),r.url().split('?')[0]);}); page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForLoadState('networkidle');
  await page.getByText('理论权重体积计算器UI验收', {exact:true}).first().click(); await page.waitForTimeout(8000); console.log(JSON.stringify({ errors, text: (await page.locator('body').innerText()).slice(0, 5500), buttons: await page.getByRole('button').evaluateAll(list => list.map(x => ({text: x.textContent, aria: x.getAttribute('aria-label'), title: x.getAttribute('title')})).slice(0, 40)) }));
  await mkdir('test-output', {recursive:true}); await page.screenshot({path:'test-output/web-initial.png'});
} finally { await browser.close(); }


