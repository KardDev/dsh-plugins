import { validateDecision, analyzeDecision, formatReport } from './engine.js';

/** Create an inert download payload; browser I/O remains in the click handler. */
export function buildExport(raw, weights, format) {
  if (!['json', 'markdown'].includes(format)) throw new Error('Unsupported export format.');
  const decision = validateDecision(raw);
  const analysis = analyzeDecision(decision, weights);
  const selected = Object.fromEntries(analysis.weights.map(({ id, weight }) => [id, weight]));
  if (format === 'markdown') {
    return { filename: 'decision-lab.md', mime: 'text/markdown;charset=utf-8', text: formatReport(decision, selected) };
  }
  return {
    filename: 'decision-lab.json', mime: 'application/json;charset=utf-8',
    text: `${JSON.stringify({ version: 1, decision, weights: selected, analysis }, null, 2)}\n`,
  };
}
