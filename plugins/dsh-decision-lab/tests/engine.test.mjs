import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../lib/engine.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

function decision() {
  const cell = (value) => ({ value, low: value, high: value, basis: 'measured', note: 'Recorded observation.' });
  return {
    version: 1,
    title: 'Choose a launch',
    criteria: [
      { id: 'quality', label: 'Quality', weight: 3 },
      { id: 'speed', label: 'Speed', weight: 1 },
    ],
    options: [
      { id: 'alpha', label: 'Alpha', scores: { quality: cell(8), speed: cell(4) } },
      { id: 'beta', label: 'Beta', scores: { quality: cell(6), speed: cell(8) } },
    ],
  };
}

function matrixDecision(matrix, weights) {
  return {
    version: 1, title: 'Matrix fixture',
    criteria: weights.map((weight, i) => ({ id: `c${i}`, label: `Criterion ${i}`, weight })),
    options: matrix.map((values, i) => ({
      id: `o${i}`, label: `Option ${i}`,
      scores: Object.fromEntries(values.map((value, j) => [`c${j}`, {
        value, low: value, high: value, basis: 'measured', note: 'Test fixture.',
      }])),
    })),
  };
}

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= 1e-12, message ?? `${actual} differs from ${expected}`);
}

test('returns a detached canonical JSON decision without mutating its input', () => {
  const input = decision();
  input.question = 'Which launch should we choose?';
  input.assumptions = ['Use the same evaluation period.'];
  input.criteria[0].description = 'Higher is better.';
  const before = structuredClone(input);
  const output = engine.validateDecision(input);
  assert.deepEqual(output, before);
  output.options[0].scores.quality.value = 1;
  output.assumptions.push('Detached.');
  assert.deepEqual(input, before);
  assert.notEqual(output.criteria, input.criteria);
});

test('rejects malformed decisions at both validation and analysis boundaries', async (t) => {
  const cases = [
    ['wrong version', (d) => { d.version = '1'; }],
    ['empty title', (d) => { d.title = ''; }],
    ['long title', (d) => { d.title = 'x'.repeat(161); }],
    ['empty question', (d) => { d.question = ''; }],
    ['long question', (d) => { d.question = 'x'.repeat(1201); }],
    ['one criterion', (d) => { d.criteria.pop(); }],
    ['nine criteria', (d) => { d.criteria = Array(9).fill(d.criteria[0]); }],
    ['one option', (d) => { d.options.pop(); }],
    ['nine options', (d) => { d.options = Array(9).fill(d.options[0]); }],
    ['unknown root field', (d) => { d.extra = true; }],
    ['unknown criterion field', (d) => { d.criteria[0].extra = true; }],
    ['unknown option field', (d) => { d.options[0].extra = true; }],
    ['unknown score field', (d) => { d.options[0].scores.quality.extra = true; }],
    ['missing score key', (d) => { delete d.options[0].scores.speed; }],
    ['unknown score key', (d) => { d.options[0].scores.extra = d.options[0].scores.speed; }],
    ['missing score value', (d) => { delete d.options[0].scores.quality.value; }],
    ['missing note', (d) => { delete d.options[0].scores.quality.note; }],
    ['empty note', (d) => { d.options[0].scores.quality.note = ''; }],
    ['long note', (d) => { d.options[0].scores.quality.note = 'x'.repeat(501); }],
    ['invalid basis', (d) => { d.options[0].scores.quality.basis = 'verified'; }],
    ['empty description', (d) => { d.criteria[0].description = ''; }],
    ['long description', (d) => { d.criteria[0].description = 'x'.repeat(501); }],
    ['empty criterion label', (d) => { d.criteria[0].label = ''; }],
    ['long option label', (d) => { d.options[0].label = 'x'.repeat(161); }],
    ['invalid id', (d) => { d.options[0].id = '0bad'; }],
    ['long id', (d) => { d.options[0].id = 'x'.repeat(33); }],
    ['prototype id', (d) => { d.options[0].id = 'prototype'; }],
    ['constructor id', (d) => { d.criteria[0].id = 'constructor'; }],
    ['duplicate option', (d) => { d.options[1].id = d.options[0].id; }],
    ['duplicate criterion', (d) => { d.criteria[1].id = d.criteria[0].id; }],
    ['string weight', (d) => { d.criteria[0].weight = '3'; }],
    ['negative weight', (d) => { d.criteria[0].weight = -1; }],
    ['large weight', (d) => { d.criteria[0].weight = 101; }],
    ['zero weight total', (d) => { d.criteria.forEach((c) => { c.weight = 0; }); }],
    ['NaN weight', (d) => { d.criteria[0].weight = NaN; }],
    ['infinite weight', (d) => { d.criteria[0].weight = Infinity; }],
    ['string score', (d) => { d.options[0].scores.quality.value = '8'; }],
    ['negative low', (d) => { d.options[0].scores.quality.low = -1; }],
    ['large high', (d) => { d.options[0].scores.quality.high = 11; }],
    ['inverted low', (d) => { d.options[0].scores.quality.low = 9; }],
    ['inverted high', (d) => { d.options[0].scores.quality.high = 7; }],
    ['infinite score', (d) => { d.options[0].scores.quality.high = Infinity; }],
    ['too many assumptions', (d) => { d.assumptions = Array(13).fill('x'); }],
    ['empty assumption', (d) => { d.assumptions = ['']; }],
    ['long assumption', (d) => { d.assumptions = ['x'.repeat(501)]; }],
    ['numeric assumption', (d) => { d.assumptions = [1]; }],
    ['assumptions object', (d) => { d.assumptions = {}; }],
  ];
  for (const [label, alter] of cases) {
    await t.test(label, () => {
      const input = decision();
      alter(input);
      assert.throws(() => engine.validateDecision(input), TypeError);
      assert.throws(() => engine.analyzeDecision(input), TypeError);
    });
  }
  for (const input of [null, [], 'decision', 1, true]) {
    assert.throws(() => engine.validateDecision(input), TypeError);
  }
});

test('accepts inclusive bounds without coercing or rewriting user text', () => {
  const input = decision();
  input.title = 'x'.repeat(160);
  input.question = 'x'.repeat(1200);
  input.assumptions = Array(12).fill('x'.repeat(500));
  input.criteria[0].description = 'x'.repeat(500);
  input.criteria[0].weight = 0;
  input.criteria[1].weight = 100;
  input.options[0].scores.quality = { value: 0, low: 0, high: 10, basis: 'assumption', note: 'x'.repeat(500) };
  input.options[1].scores.speed = { value: 10, low: 0, high: 10, basis: 'estimate', note: '  Preserve surrounding whitespace.  ' };
  assert.deepEqual(engine.validateDecision(input), input);
});

test('rejects non-JSON data without executing accessors or dropping properties', async (t) => {
  const cases = [
    ['undefined optional field', (d) => { d.question = undefined; }],
    ['symbol in array', (d) => { d.criteria[Symbol('hidden')] = 'x'; }],
    ['extra array property', (d) => { d.options.extra = 'x'; }],
    ['sparse criteria', (d) => { delete d.criteria[0]; }],
    ['sparse assumptions', (d) => { d.assumptions = new Array(2); }],
    ['hidden field', (d) => { Object.defineProperty(d, 'title', { value: 'Hidden', enumerable: false }); }],
    ['function', (d) => { d.question = () => 'x'; }],
    ['bigint', (d) => { d.criteria[0].weight = 1n; }],
    ['symbol', (d) => { d.title = Symbol('x'); }],
    ['date', (d) => { d.options[0].scores.quality = new Date(0); }],
    ['custom prototype', (d) => { Object.setPrototypeOf(d.criteria[0], { weight: 3 }); }],
    ['array subclass', (d) => { d.criteria = new (class extends Array {})(...d.criteria); }],
    ['circular value', (d) => { d.assumptions = [d]; }],
  ];
  for (const [label, alter] of cases) {
    await t.test(label, () => {
      const input = decision();
      alter(input);
      assert.throws(() => engine.validateDecision(input), TypeError);
    });
  }
  let getterCalls = 0;
  const input = decision();
  Object.defineProperty(input, 'title', { enumerable: true, get() { getterCalls += 1; return 'Accessor'; } });
  assert.throws(() => engine.validateDecision(input), TypeError);
  assert.equal(getterCalls, 0);
});

test('enforces the inclusive 65536-byte UTF-8 JSON transport limit', () => {
  const input = {
    version: 1, title: 'Unicode boundary',
    criteria: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, label: `Criterion ${i}`, weight: 1 })),
    options: [],
  };
  input.options = Array.from({ length: 8 }, (_, i) => ({
    id: `o${i}`, label: `Option ${i}`,
    scores: Object.fromEntries(input.criteria.map(({ id }) => [id, {
      value: 5, low: 0, high: 10, basis: 'estimate', note: '😀'.repeat(200),
    }])),
  }));
  const bytes = () => new TextEncoder().encode(JSON.stringify(input)).byteLength;
  let remaining = 65536 - bytes();
  assert.ok(remaining > 0);
  for (const option of input.options) {
    for (const score of Object.values(option.scores)) {
      const added = Math.min(remaining, 300);
      score.note += 'x'.repeat(added);
      remaining -= added;
    }
  }
  assert.equal(remaining, 0);
  assert.equal(bytes(), 65536);
  assert.deepEqual(engine.validateDecision(input), input);
  input.options.at(-1).scores.c7.note += 'x';
  assert.equal(bytes(), 65537);
  assert.throws(() => engine.validateDecision(input), /65536/);
});

test('accepts null-prototype records and repeated references as detached JSON', () => {
  const input = decision();
  input.options[0].scores = Object.assign(Object.create(null), input.options[0].scores);
  input.options[1].scores.quality = input.options[0].scores.quality;
  const output = engine.validateDecision(input);
  assert.equal(Object.getPrototypeOf(output.options[0].scores), Object.prototype);
  assert.notEqual(output.options[0].scores.quality, output.options[1].scores.quality);
});

test('uses complete weight overrides without mutating either input', () => {
  const input = decision();
  const overrides = { quality: 1, speed: 3 };
  const before = structuredClone(input);
  const result = engine.analyzeDecision(input, overrides);
  assert.deepEqual(result.weights, [
    { id: 'quality', weight: 1, share: 0.25 },
    { id: 'speed', weight: 3, share: 0.75 },
  ]);
  assert.deepEqual(result.ranking.map(({ id }) => id), ['beta', 'alpha']);
  close(result.ranking[0].score, 7.5);
  close(result.ranking[1].score, 5);
  assert.deepEqual(input, before);
  assert.deepEqual(overrides, { quality: 1, speed: 3 });
  const tiny = engine.analyzeDecision(input, { quality: Number.MIN_VALUE, speed: Number.MIN_VALUE });
  assert.deepEqual(tiny.weights.map(({ share }) => share), [0.5, 0.5]);
  close(tiny.ranking[0].score, 7);
});

test('rejects incomplete or nonnumeric overrides instead of falling back', () => {
  for (const overrides of [null, [], 1, { quality: 1 }, { quality: 1, speed: 1, extra: 2 },
    { quality: '1', speed: 1 }, { quality: 0, speed: 0 }, { quality: -1, speed: 1 },
    { quality: 101, speed: 1 }, { quality: NaN, speed: 1 }, { quality: Infinity, speed: 1 },
    Object.assign(Object.create({ inherited: true }), { quality: 1, speed: 1 }),
    Object.defineProperty({ speed: 1 }, 'quality', { enumerable: true, get() { throw new Error('Do not invoke'); } }),
  ]) {
    assert.throws(() => engine.analyzeDecision(decision(), overrides), TypeError);
  }
});

test('reports weighted bounds without treating overlapping ranges as robust', () => {
  const input = decision();
  Object.assign(input.options[0].scores.quality, { low: 7, high: 9 });
  Object.assign(input.options[0].scores.speed, { low: 2, high: 6 });
  Object.assign(input.options[1].scores.quality, { low: 5, high: 7 });
  Object.assign(input.options[1].scores.speed, { low: 7, high: 9 });
  const result = engine.analyzeDecision(input);
  assert.deepEqual(result.leaders, ['alpha']);
  close(result.ranking[0].low, 5.75);
  close(result.ranking[0].high, 8.25);
  close(result.ranking[1].low, 5.5);
  close(result.ranking[1].high, 7.5);
  assert.equal(result.robustWinner, null);
  assert.equal(engine.analyzeDecision(decision()).robustWinner, 'alpha');
});

test('requires a robust lower bound to exceed every competing upper bound by more than 1e-9', () => {
  const input = decision();
  for (const score of Object.values(input.options[0].scores)) Object.assign(score, { value: 8, low: 6, high: 9 });
  for (const score of Object.values(input.options[1].scores)) Object.assign(score, { value: 5, low: 4, high: 6 });
  assert.equal(engine.analyzeDecision(input).robustWinner, null);
  for (const score of Object.values(input.options[1].scores)) score.high = 6 - 0.5e-9;
  assert.equal(engine.analyzeDecision(input).robustWinner, null);
  for (const score of Object.values(input.options[1].scores)) score.high = 6 - 2e-9;
  assert.equal(engine.analyzeDecision(input).robustWinner, 'alpha');
  const third = structuredClone(input.options[1]);
  third.id = 'gamma';
  third.label = 'Gamma';
  for (const score of Object.values(third.scores)) Object.assign(score, { value: 1, low: 0, high: 9 });
  input.options.push(third);
  assert.equal(engine.analyzeDecision(input).robustWinner, null);
});

test('preserves input order for point-score ties within 1e-9', () => {
  const input = decision();
  for (const score of Object.values(input.options[0].scores)) Object.assign(score, { value: 5, low: 5, high: 5 });
  for (const score of Object.values(input.options[1].scores)) Object.assign(score, { value: 5 + 0.5e-9, low: 5, high: 6 });
  const tied = engine.analyzeDecision(input);
  assert.deepEqual(tied.ranking.map(({ id }) => id), ['alpha', 'beta']);
  assert.deepEqual(tied.leaders, ['alpha', 'beta']);
  assert.equal(tied.robustWinner, null);
  for (const score of Object.values(input.options[1].scores)) score.value = 5 + 2e-9;
  const distinct = engine.analyzeDecision(input);
  assert.deepEqual(distinct.ranking.map(({ id }) => id), ['beta', 'alpha']);
  assert.deepEqual(distinct.leaders, ['beta']);
});

test('compares point dominance across every criterion including zero-weight criteria', () => {
  const input = decision();
  input.criteria[1].weight = 0;
  const third = structuredClone(input.options[1]);
  third.id = 'gamma';
  third.label = 'Gamma';
  Object.assign(third.scores.speed, { value: 3, low: 0, high: 10 });
  input.options.push(third);
  const result = engine.analyzeDecision(input);
  assert.deepEqual(result.ranking.find(({ id }) => id === 'alpha').dominatedBy, []);
  assert.deepEqual(result.ranking.find(({ id }) => id === 'beta').dominatedBy, []);
  assert.deepEqual(result.ranking.find(({ id }) => id === 'gamma').dominatedBy, ['alpha', 'beta']);
  input.options[2].scores = structuredClone(input.options[0].scores);
  assert.deepEqual(engine.analyzeDecision(input).ranking.find(({ id }) => id === 'gamma').dominatedBy, []);
  Object.assign(input.options[2].scores.quality, { value: 8 + 0.5e-9, high: 9 });
  assert.deepEqual(engine.analyzeDecision(input).ranking.find(({ id }) => id === 'alpha').dominatedBy, ['gamma']);
});

test('finds the nearest sampled share with an entirely new leader set', () => {
  const result = engine.analyzeDecision(decision());
  assert.deepEqual(result.sensitivities, [
    { criterionId: 'quality', label: 'Quality', currentShare: 0.75, nearestFlip: { share: 0.66, leaders: ['beta'] } },
    { criterionId: 'speed', label: 'Speed', currentShare: 0.25, nearestFlip: { share: 0.34, leaders: ['beta'] } },
  ]);
  const adjusted = engine.analyzeDecision(decision(), { quality: 1, speed: 3 });
  assert.equal(adjusted.sensitivities[0].currentShare, 0.25);
  assert.deepEqual(adjusted.sensitivities[0].nearestFlip, { share: 0.67, leaders: ['alpha'] });
});

test('rescales the other criteria proportionally during sensitivity sampling', () => {
  const input = matrixDecision([[10, 0, 0], [0, 10, 0], [0, 0, 10]], [6, 3, 1]);
  const result = engine.analyzeDecision(input);
  assert.deepEqual(result.sensitivities.map(({ nearestFlip }) => nearestFlip), [
    { share: 0.42, leaders: ['o1'] },
    { share: 0.47, leaders: ['o1'] },
    { share: 0.41, leaders: ['o2'] },
  ]);
});

test('distributes sensitivity remainder equally when all other weights are zero', () => {
  const result = engine.analyzeDecision(matrixDecision([[10, 0, 0], [0, 10, 10]], [1, 0, 0]));
  assert.deepEqual(result.sensitivities.map(({ nearestFlip }) => nearestFlip), [
    { share: 0.49, leaders: ['o1'] },
    { share: 0.51, leaders: ['o1'] },
    { share: 0.51, leaders: ['o1'] },
  ]);
});

test('chooses the lower sampled share when two flips are equally distant', () => {
  const result = engine.analyzeDecision(matrixDecision([[10, 0], [0, 10], [6, 6]], [1, 1]));
  assert.deepEqual(result.leaders, ['o2']);
  assert.deepEqual(result.sensitivities.map(({ nearestFlip }) => nearestFlip), [
    { share: 0.39, leaders: ['o1'] },
    { share: 0.39, leaders: ['o0'] },
  ]);
});

test('does not count losing one co-leader as a disjoint flip', () => {
  const result = engine.analyzeDecision(matrixDecision([[10, 0], [0, 10], [6, 6]], [2, 3]));
  assert.deepEqual(result.leaders, ['o1', 'o2']);
  assert.deepEqual(result.sensitivities.map(({ nearestFlip }) => nearestFlip), [
    { share: 0.61, leaders: ['o0'] },
    { share: 0.39, leaders: ['o0'] },
  ]);
  const tied = engine.analyzeDecision(matrixDecision([[10, 0], [0, 10]], [1, 1]));
  assert.ok(tied.sensitivities.every(({ nearestFlip }) => nearestFlip === null));
  const dominant = engine.analyzeDecision(matrixDecision([[10, 10], [0, 0]], [1, 1]));
  assert.ok(dominant.sensitivities.every(({ nearestFlip }) => nearestFlip === null));
});

test('samples both endpoints and returns every sampled co-leader in input order', () => {
  const end = engine.analyzeDecision(matrixDecision([[1, 1], [1 + 2e-9, 0]], [1, 1]));
  assert.deepEqual(end.sensitivities[0].nearestFlip, { share: 1, leaders: ['o1'] });
  assert.deepEqual(end.sensitivities[1].nearestFlip, { share: 0, leaders: ['o1'] });
  const tied = engine.analyzeDecision(matrixDecision([[10, 0], [0, 10], [0, 10]], [3, 1]));
  assert.deepEqual(tied.sensitivities[0].nearestFlip, { share: 0.49, leaders: ['o1', 'o2'] });
});

test('always states subjectivity, non-probabilistic ranges, and fixed-score grid limitations', () => {
  const result = engine.analyzeDecision(decision());
  const warnings = result.warnings.join('\n');
  assert.match(warnings, /subjective/i);
  assert.match(warnings, /not.*probabilit/i);
  assert.match(warnings, /not.*confidence intervals/i);
  assert.match(warnings, /0\.01/);
  assert.match(warnings, /fixed.*scores|scores.*fixed/i);
  assert.match(warnings, /no.*proof.*global stability|not.*proof.*global stability/i);
  assert.match(warnings, /measured.*not.*verif/i);
  assert.doesNotMatch(warnings, /unmeasured|zero weight|no robust winner/i);
});

test('flags unmeasured cells, current zero weights, and absence of a robust winner', () => {
  const input = decision();
  input.options[0].scores.quality.basis = 'estimate';
  input.options[0].scores.speed.basis = 'assumption';
  input.options[1].scores.quality.high = 10;
  const warnings = engine.analyzeDecision(input, { quality: 1, speed: 0 }).warnings.join('\n');
  assert.match(warnings, /unmeasured/i);
  assert.match(warnings, /zero weight/i);
  assert.match(warnings, /no robust winner/i);
});

test('exports current weights, result, sensitivity, and full provenance as Markdown', () => {
  const input = decision();
  input.question = 'Which launch should we choose?';
  input.criteria[0].description = 'Craft quality before speed';
  input.assumptions = ['Same audience and launch window'];
  input.options[0].scores.quality.note = 'Internal benchmark sample';
  input.options[0].scores.speed.basis = 'estimate';
  input.options[0].scores.speed.note = 'Planning estimate';
  const before = structuredClone(input);
  const report = engine.formatReport(input, { quality: 1, speed: 3 });
  assert.match(report, /^# Choose a launch/m);
  for (const phrase of ['Which launch should we choose?', 'Beta', 'Alpha', 'Quality', 'Speed',
    'Craft quality before speed', 'Same audience and launch window', 'Internal benchmark sample',
    'Planning estimate', 'measured', 'estimate', 'alpha', 'beta', 'quality', 'speed',
    '75.00%', '25.00%', '67.00%', '7.500', '5.000']) assert.ok(report.includes(phrase), phrase);
  for (const heading of ['Ranking', 'Weights', 'Sensitivity', 'Input provenance', 'Assumptions', 'Limitations']) {
    assert.ok(report.includes(`## ${heading}`), heading);
  }
  assert.match(report, /Leaders: Beta/);
  assert.match(report, /Robust winner: Beta/);
  assert.match(report, /Original weight/);
  for (const warning of engine.analyzeDecision(input, { quality: 1, speed: 3 }).warnings) {
    assert.ok(report.includes(warning), warning);
  }
  assert.deepEqual(input, before);
  assert.equal(report, engine.formatReport(input, { quality: 1, speed: 3 }));
});

test('renders literal Markdown content without injecting tables, links, or HTML', () => {
  const input = decision();
  input.title = '<script>alert(1)</script>';
  input.question = '[click](javascript:alert(1))';
  input.criteria[0].description = '**not bold**';
  input.options[0].label = 'Alpha | fake\n# Heading';
  input.options[0].scores.quality.note = '`code` & <img src=x onerror=alert(1)>\r\nnext';
  input.assumptions = ['[x](https://example.invalid)'];
  const report = engine.formatReport(input);
  assert.ok(!report.includes('<script>'));
  assert.ok(!report.includes('<img'));
  assert.ok(!report.includes('[click]('));
  assert.ok(!report.includes('[x]('));
  assert.ok(!report.includes('\n# Heading'));
  assert.ok(!report.includes('Alpha | fake'));
  assert.ok(report.includes('Alpha \\| fake'));
  assert.ok(report.includes('&lt;script&gt;'));
  assert.ok(report.includes('\\`code\\` &amp; &lt;img'));
  assert.ok(report.includes('\\*\\*not bold\\*\\*'));
});

test('exports explicit no-flip and missing-optional-field explanations', () => {
  const report = engine.formatReport(matrixDecision([[5, 5], [5, 5]], [1, 1]));
  assert.match(report, /No disjoint leader set on the sampled grid/);
  assert.match(report, /Robust winner: none/);
  assert.match(report, /No assumptions supplied/);
  assert.doesNotMatch(report, /undefined|NaN/);
  assert.throws(() => engine.formatReport({ ...decision(), extra: true }), TypeError);
  assert.throws(() => engine.formatReport(decision(), { quality: 1 }), TypeError);
});

test('ships a valid illustrative launch example that can be analyzed and exported', async () => {
  const { readFile } = await import('node:fs/promises');
  const input = JSON.parse(await readFile(new URL('../examples/launch.json', import.meta.url), 'utf8'));
  const canonical = engine.validateDecision(input);
  assert.ok(canonical.assumptions.some((item) => /illustrative|fictional/i.test(item)));
  const result = engine.analyzeDecision(input);
  assert.equal(result.ranking.length, input.options.length);
  assert.ok(result.leaders.length > 0);
  assert.ok(result.sensitivities.some(({ nearestFlip }) => nearestFlip !== null));
  assert.ok(engine.formatReport(input).includes(input.title));
});

test('keeps weighted outputs in 0..10 despite floating-point accumulation', () => {
  const weights = [85.82663084380329, 96.31207894999534, 86.82103827595711, 12.343084788881242,
    96.81500983424485, 27.85114368889481, 48.555554915219545, 58.6520530981943];
  const result = engine.analyzeDecision(matrixDecision([Array(8).fill(10), Array(8).fill(0)], weights));
  for (const row of result.ranking) {
    for (const field of ['score', 'low', 'high']) assert.ok(row[field] >= 0 && row[field] <= 10, `${field}=${row[field]}`);
  }
  assert.equal(result.ranking[0].score, 10);
});

test('orders chained near-ties by maximum-anchored groups with leaders first', () => {
  const values = [5, 5 + 0.75e-9, 5 + 1.5e-9];
  const input = matrixDecision(values.map((value) => [value, value]), [1, 1]);
  const result = engine.analyzeDecision(input);
  assert.deepEqual(result.leaders, ['o1', 'o2']);
  assert.deepEqual(result.ranking.map(({ id }) => id), ['o1', 'o2', 'o0']);
  assert.deepEqual(result.ranking.slice(0, result.leaders.length).map(({ id }) => id), result.leaders);
});

test('canonicalizes schema key order independently of input insertion order', () => {
  const original = decision();
  function reverseKeys(value) {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reverseKeys(entry)]));
    return value;
  }
  assert.equal(JSON.stringify(engine.validateDecision(reverseKeys(original))), JSON.stringify(engine.validateDecision(original)));
});

test('ranks options by normalized weighted point scores', () => {
  assert.equal(typeof engine.analyzeDecision, 'function', 'weighted decision engine is not implemented');
  const result = engine.analyzeDecision(decision());
  assert.deepEqual(result.ranking.map(({ id }) => id), ['alpha', 'beta']);
  close(result.ranking[0].score, 7);
  close(result.ranking[1].score, 6.5);
});
