const EPSILON = 1e-9;
const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype', ...Object.getOwnPropertyNames(Object.prototype)]);

function invalid(path, message) {
  throw new TypeError(`Invalid decision: ${path} ${message}`);
}

function object(value, path, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    invalid(path, 'must be a plain object.');
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Reflect.ownKeys(value)) {
    if (!allowed.has(key)) invalid(path, `has unknown field ${String(key)}.`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) invalid(`${path}.${key}`, 'is required.');
  }
}

function text(value, path, maximum) {
  if (typeof value !== 'string' || value.length < 1 || [...value].length > maximum) {
    invalid(path, `must be a string of 1..${maximum} characters.`);
  }
}

function number(value, path, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    invalid(path, `must be a finite number in 0..${maximum}.`);
  }
}

function list(value, path, minimum, maximum) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    invalid(path, `must be an array of ${minimum}..${maximum} items.`);
  }
}

function uniqueId(value, path, seen) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(value) || FORBIDDEN_IDS.has(value)) {
    invalid(path, 'must be a safe lowercase identifier of 1..32 characters.');
  }
  if (seen.has(value)) invalid(path, 'must be unique within its group.');
  seen.add(value);
}

// Inspect data descriptors before reading values: JSON serialization would silently
// discard undefined/symbols, invoke getters/toJSON, and turn array holes into null.
function jsonSnapshot(raw) {
  const ancestors = new Set();
  const encoder = new TextEncoder();
  let bytes = 0;
  let nodes = 0;
  function charge(count) {
    bytes += count;
    if (bytes > 65536) invalid('decision', 'JSON representation must be at most 65536 UTF-8 bytes.');
  }
  function stringBytes(value) {
    if (value.length > 65536) invalid('decision', 'JSON representation must be at most 65536 UTF-8 bytes.');
    return encoder.encode(JSON.stringify(value)).byteLength;
  }
  function copy(value, path, depth) {
    nodes += 1;
    if (nodes > 65536 || depth > 8) invalid(path, 'exceeds the bounded JSON structure.');
    if (value === null || typeof value === 'boolean') {
      charge(value === false ? 5 : 4);
      return value;
    }
    if (typeof value === 'string') {
      charge(stringBytes(value));
      return value;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) invalid(path, 'must be finite JSON data.');
      charge(JSON.stringify(value).length);
      return value;
    }
    if (typeof value !== 'object') invalid(path, 'must contain only JSON data.');
    if (ancestors.has(value)) invalid(path, 'must not contain circular references.');
    const isArray = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      invalid(path, 'must contain only plain JSON objects and arrays.');
    }
    if (isArray && value.length > 65536) invalid(path, 'exceeds the 65536-byte JSON limit.');
    const keys = Reflect.ownKeys(value);
    if (isArray && keys.length !== value.length + 1) invalid(path, 'must not contain array holes or extra properties.');
    const entryCount = keys.length - (isArray ? 1 : 0);
    charge(2 + Math.max(0, entryCount - 1)); // Brackets/braces and commas.
    const result = isArray ? [] : Object.create(null);
    ancestors.add(value);
    for (const key of keys) {
      if (isArray && key === 'length') continue;
      if (typeof key !== 'string' || (isArray && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) {
        invalid(path, 'must not contain symbol keys or extra array properties.');
      }
      if (!isArray) charge(stringBytes(key) + 1); // Key and colon.
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        invalid(`${path}.${key}`, 'must be enumerable JSON data, not an accessor.');
      }
      result[key] = copy(descriptor.value, `${path}.${key}`, depth + 1);
    }
    ancestors.delete(value);
    return result;
  }
  // Byte accounting happens while copying, before a large malformed tree can
  // expand into a serialized allocation. Round-trip only the bounded snapshot.
  return JSON.parse(JSON.stringify(copy(raw, 'decision', 0)));
}

export function validateDecision(raw) {
  raw = jsonSnapshot(raw);
  object(raw, 'decision', ['version', 'title', 'criteria', 'options'], ['question', 'assumptions']);
  if (raw.version !== 1) invalid('version', 'must be exactly 1.');
  text(raw.title, 'title', 160);
  if (Object.hasOwn(raw, 'question')) text(raw.question, 'question', 1200);
  if (Object.hasOwn(raw, 'assumptions')) {
    list(raw.assumptions, 'assumptions', 0, 12);
    raw.assumptions.forEach((item, i) => text(item, `assumptions[${i}]`, 500));
  }
  list(raw.criteria, 'criteria', 2, 8);
  list(raw.options, 'options', 2, 8);
  const criterionIds = new Set();
  let total = 0;
  raw.criteria.forEach((criterion, i) => {
    const path = `criteria[${i}]`;
    object(criterion, path, ['id', 'label', 'weight'], ['description']);
    uniqueId(criterion.id, `${path}.id`, criterionIds);
    text(criterion.label, `${path}.label`, 160);
    number(criterion.weight, `${path}.weight`, 100);
    total += criterion.weight;
    if (Object.hasOwn(criterion, 'description')) text(criterion.description, `${path}.description`, 500);
  });
  if (total === 0) invalid('criteria', 'must have a nonzero total weight.');
  const optionIds = new Set();
  raw.options.forEach((option, i) => {
    const path = `options[${i}]`;
    object(option, path, ['id', 'label', 'scores']);
    uniqueId(option.id, `${path}.id`, optionIds);
    text(option.label, `${path}.label`, 160);
    object(option.scores, `${path}.scores`, [...criterionIds]);
    for (const id of criterionIds) {
      const scorePath = `${path}.scores.${id}`;
      const score = option.scores[id];
      object(score, scorePath, ['value', 'low', 'high', 'basis', 'note']);
      for (const field of ['value', 'low', 'high']) number(score[field], `${scorePath}.${field}`, 10);
      if (score.low > score.value || score.value > score.high) invalid(scorePath, 'must satisfy low <= value <= high.');
      if (!['measured', 'estimate', 'assumption'].includes(score.basis)) invalid(`${scorePath}.basis`, 'must be measured, estimate, or assumption.');
      text(score.note, `${scorePath}.note`, 500);
    }
  });
  return {
    version: 1,
    title: raw.title,
    ...(Object.hasOwn(raw, 'question') ? { question: raw.question } : {}),
    criteria: raw.criteria.map((criterion) => ({
      id: criterion.id, label: criterion.label, weight: criterion.weight,
      ...(Object.hasOwn(criterion, 'description') ? { description: criterion.description } : {}),
    })),
    options: raw.options.map((option) => ({
      id: option.id, label: option.label,
      scores: Object.fromEntries(raw.criteria.map(({ id }) => {
        const { value, low, high, basis, note } = option.scores[id];
        return [id, { value, low, high, basis, note }];
      })),
    })),
    ...(Object.hasOwn(raw, 'assumptions') ? { assumptions: [...raw.assumptions] } : {}),
  };
}

function resolveWeights(decision, overrides) {
  if (overrides !== undefined) {
    overrides = jsonSnapshot(overrides);
    object(overrides, 'weights', decision.criteria.map(({ id }) => id));
  }
  const weights = decision.criteria.map(({ id, weight }) => ({ id, weight: overrides === undefined ? weight : overrides[id] }));
  weights.forEach(({ id, weight }) => number(weight, `weights.${id}`, 100));
  const total = weights.reduce((sum, { weight }) => sum + weight, 0);
  if (total === 0) invalid('weights', 'must have a nonzero total.');
  return weights.map(({ id, weight }) => ({ id, weight, share: weight / total }));
}

function weightedValue(option, weights, field) {
  const value = weights.reduce((sum, { id, share }) => sum + option.scores[id][field] * share, 0);
  // Valid inputs form a convex combination; clamp only endpoint roundoff.
  return Math.max(0, Math.min(10, value));
}

function leaderIds(rows) {
  const maximum = Math.max(...rows.map(({ score }) => score));
  return rows.filter(({ score }) => maximum - score <= EPSILON).map(({ id }) => id);
}

function rankRows(rows) {
  // Approximate equality is not transitive, so an epsilon sort comparator can
  // leave a nonleader first. Anchor each tie group to its maximum and retain
  // input order within the group, then repeat for the remaining rows.
  const ranking = [];
  let remaining = rows;
  while (remaining.length) {
    const leaders = new Set(leaderIds(remaining));
    ranking.push(...remaining.filter(({ id }) => leaders.has(id)));
    remaining = remaining.filter(({ id }) => !leaders.has(id));
  }
  return ranking;
}

function sensitivity(decision, weights, originalLeaders) {
  const original = new Set(originalLeaders);
  return decision.criteria.map((criterion, index) => {
    const currentShare = weights[index].share;
    const otherTotal = weights.reduce((sum, item, i) => sum + (i === index ? 0 : item.weight), 0);
    let nearestFlip = null;
    let nearestDistance = Infinity;
    // Ascending grid plus roundoff-only distance tolerance makes equal-distance
    // choices deterministic, preferring the lower share. This is not a search
    // for an exact analytical threshold, nor a test of changing score inputs.
    for (let tick = 0; tick <= 100; tick += 1) {
      const share = tick / 100;
      const sampled = weights.map((item, i) => ({
        id: item.id,
        share: i === index ? share : (1 - share) * (otherTotal === 0 ? 1 / (weights.length - 1) : item.weight / otherTotal),
      }));
      const leaders = leaderIds(decision.options.map((option) => ({ id: option.id, score: weightedValue(option, sampled, 'value') })));
      const distance = Math.abs(share - currentShare);
      if (!leaders.some((id) => original.has(id)) && distance < nearestDistance - 4 * Number.EPSILON) {
        nearestDistance = distance;
        nearestFlip = { share, leaders };
      }
    }
    return { criterionId: criterion.id, label: criterion.label, currentShare, nearestFlip };
  });
}

export function analyzeDecision(raw, overrides) {
  raw = validateDecision(raw);
  const weights = resolveWeights(raw, overrides);
  const rows = raw.options.map((option) => ({
    id: option.id,
    label: option.label,
    score: weightedValue(option, weights, 'value'),
    low: weightedValue(option, weights, 'low'),
    high: weightedValue(option, weights, 'high'),
    dominatedBy: raw.options.filter((other) => other !== option
      && raw.criteria.every(({ id }) => other.scores[id].value >= option.scores[id].value)
      && raw.criteria.some(({ id }) => other.scores[id].value > option.scores[id].value))
      .map(({ id }) => id),
  }));
  const leaders = leaderIds(rows);
  const ranking = rankRows(rows);
  const leader = ranking.find(({ id }) => id === leaders[0]);
  const robustWinner = leaders.length === 1 && ranking.every((row) => row === leader || leader.low - row.high > EPSILON)
    ? leader.id : null;
  const sensitivities = sensitivity(raw, weights, leaders);
  const warnings = [
    'Scores and weights are subjective inputs; this is a decision aid, not a recommendation or factual verification.',
    'Low/high ranges are supplied bounds, not probabilities and not confidence intervals.',
    'Sensitivity varies one criterion share on a 0.01 grid from 0 to 1 with fixed scores; other weights are rescaled proportionally, or equally if their total is zero. Finding no sampled disjoint leader set is not proof of global stability.',
    'A measured tag is user-supplied and is not independently verified.',
  ];
  if (raw.options.some((option) => raw.criteria.some(({ id }) => option.scores[id].basis !== 'measured'))) {
    warnings.push('Unmeasured cells use estimates or assumptions; review their notes and ranges.');
  }
  if (weights.some(({ weight }) => weight === 0)) {
    warnings.push('Zero weights exclude criteria from weighted scores, but not from point-value dominance comparisons.');
  }
  if (robustWinner === null) warnings.push('No robust winner: no unique leader has a lower bound greater than every competing upper bound by more than 1e-9.');
  return { weights, ranking, leaders, robustWinner, sensitivities, warnings };
}

function markdown(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, '\\$&')
    .replace(/\r\n|\r|\n/g, '<br>');
}

/** A deterministic, side-effect-free report of the currently selected weights. */
export function formatReport(raw, overrides) {
  const decision = validateDecision(raw);
  const analysis = analyzeDecision(decision, overrides);
  const percent = (share) => `${(share * 100).toFixed(2)}%`;
  const names = (ids) => ids.map((id) => {
    const option = decision.options.find((item) => item.id === id);
    return `${markdown(option.label)} (${markdown(id)})`;
  }).join(', ');
  const lines = [`# ${markdown(decision.title)}`, '', `Schema version: ${decision.version}`, ''];
  if (decision.question !== undefined) lines.push(markdown(decision.question), '');
  lines.push(
    `Leaders: ${names(analysis.leaders)}`,
    `Robust winner: ${analysis.robustWinner === null ? 'none' : names([analysis.robustWinner])}`,
    '', '## Ranking', '',
    'Scores use a higher-is-better 0–10 scale. Ranges are weighted supplied bounds. Point-score ties within 1e-9 preserve input order.', '',
    '| Option | Score | Low | High | Dominated by (point values) |',
    '| --- | ---: | ---: | ---: | --- |',
  );
  for (const row of analysis.ranking) {
    lines.push(`| ${names([row.id])} | ${row.score.toFixed(3)} | ${row.low.toFixed(3)} | ${row.high.toFixed(3)} | ${row.dominatedBy.length ? names(row.dominatedBy) : 'None'} |`);
  }
  lines.push('', '## Weights', '',
    'Analysis and sensitivity below use the current weights; original weights are retained for provenance.', '',
    '| Criterion | Current weight | Current share | Original weight | Description |',
    '| --- | ---: | ---: | ---: | --- |');
  analysis.weights.forEach((weight, i) => {
    const criterion = decision.criteria[i];
    lines.push(`| ${markdown(criterion.label)} (${markdown(criterion.id)}) | ${weight.weight} | ${percent(weight.share)} | ${criterion.weight} | ${criterion.description === undefined ? 'Not supplied' : markdown(criterion.description)} |`);
  });
  lines.push('', '## Sensitivity', '',
    'Nearest sampled share with none of the current leaders remaining a leader. Lower share wins equal-distance ties.', '',
    '| Criterion | Current share | Nearest sampled flip | Leaders there |',
    '| --- | ---: | --- | --- |');
  for (const row of analysis.sensitivities) {
    lines.push(`| ${markdown(row.label)} (${markdown(row.criterionId)}) | ${percent(row.currentShare)} | ${row.nearestFlip === null ? 'No disjoint leader set on the sampled grid' : percent(row.nearestFlip.share)} | ${row.nearestFlip === null ? '—' : names(row.nearestFlip.leaders)} |`);
  }
  lines.push('', '## Input provenance', '',
    'All basis tags and notes below are supplied inputs, not independently verified evidence.', '',
    '| Option | Criterion | Value | Low | High | Basis | Note |',
    '| --- | --- | ---: | ---: | ---: | --- | --- |');
  for (const option of decision.options) {
    for (const criterion of decision.criteria) {
      const cell = option.scores[criterion.id];
      lines.push(`| ${names([option.id])} | ${markdown(criterion.label)} (${markdown(criterion.id)}) | ${cell.value} | ${cell.low} | ${cell.high} | ${cell.basis} | ${markdown(cell.note)} |`);
    }
  }
  lines.push('', '## Assumptions', '');
  if (decision.assumptions?.length) {
    lines.push(...decision.assumptions.map((assumption) => `- ${markdown(assumption)}`));
  } else {
    lines.push('No assumptions supplied.');
  }
  lines.push('', '## Limitations', '', ...analysis.warnings.map((warning) => `- ${warning}`));
  return `${lines.join('\n')}\n`;
}
