import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
const tests = (await readdir('tests')).filter(name => name.endsWith('.test.mjs')).map(name => `tests/${name}`).sort();
const steps = [
  ['unit-integration', ['--test', ...tests]], ['build', ['scripts/build.mjs']],
  ['host-syntax', ['--check', 'index.js']], ['client-syntax', ['--check', 'client.js']],
  ['canvas', ['tests/verify-canvas.mjs']], ['canvas-delivery', ['tests/verify-canvas-delivery.mjs']], ['scenes-stream', ['tests/verify-scenes-stream.mjs']], ['state-recovery', ['tests/verify-recovery.mjs']],['refinement',['tests/verify-refinement.mjs']],['freeform',['tests/verify-freeform.mjs']],['presentation-history',['tests/verify-presentation.mjs']],['single-presentation-quick-layouts',['tests/verify-single-presentation.mjs']]
];
steps.push(['authoring-compatibility', ['tests/verify-authoring.mjs']]);
steps.push(['static-steps-and-compact-errors', ['tests/verify-steps.mjs']]);
steps.push(['everyday-reading-multiple-documents-links', ['tests/verify-reading.mjs']]);
steps.push(['visual-style-settings-previews', ['tests/verify-style-settings.mjs']]);
steps.push(['progressive-stable-preview', ['tests/verify-progressive.mjs']]);
steps.push(['extended-visuals-fences-and-lazy-engines', ['tests/verify-visual.mjs']]);
steps.push(['distinct-visual-grammar',['tests/verify-style-grammar.mjs']]);
steps.push(['internal-component-skin-boundary',['tests/verify-internal-boundary.mjs']]);
steps.push(['host-skin-boundary-geometry',['tests/verify-host-boundary.mjs']]);
steps.push(['unframed-reading-shell-cascade',['tests/verify-reading-shell.mjs']]);
steps.push(['guided-native-style-coverage', ['tests/verify-native-style.mjs']]);
steps.push(['motion-controls-and-real-state', ['tests/verify-motion.mjs']]);
steps.push(['mechanism-structure-and-kinematics',['tests/verify-mechanism.mjs']]);
steps.push(['shadow-card-content-fit-and-audits',['tests/verify-card-layout.mjs']]);
steps.push(['timeline-control-legibility-and-height',['tests/verify-timeline-controls.mjs']]);
steps.push(['copyable-text-and-code', ['tests/verify-copy.mjs']]);
steps.push(['short-scenes-targeted-edit-and-visual-observations',['tests/verify-usability.mjs']]);
if (process.env.DSH_VERIFY_INSTALLED === '1') steps.push(['installed-canvases', ['tests/verify-canvas-web.mjs']], ['installed-legacy', ['tests/verify-design-installed.mjs']]);
const results = [];
await mkdir('test-output', { recursive: true });
for (const [name, args] of steps) {
  const start = Date.now(), result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env, timeout: 180000 });
  results.push({ name, passed: result.status === 0, elapsedMs: Date.now() - start, ...(result.error ? { error: result.error.message } : {}) });
  if (result.status !== 0) { await writeFile('test-output/release-verification.json', JSON.stringify({ passed: false, results }, null, 2)); process.exit(1); }
}
const { BUILD_INFO } = await import('../lib/build-info.js');
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
await writeFile('test-output/release-verification.json', JSON.stringify({ passed: true, version, build: BUILD_INFO, installedChecks: process.env.DSH_VERIFY_INSTALLED === '1', results }, null, 2));
console.log(JSON.stringify({ passed: true, version, build: BUILD_INFO.id, steps: results.length }));
