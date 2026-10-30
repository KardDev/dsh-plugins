import { defineTool } from '@deepseek-ai/dsh-tools';
import { validateDecision, analyzeDecision, formatReport } from './lib/engine.js';

export const name = 'decision-lab';
export const inject = ['tools'];

const text = { type: 'string', required: true };
const criterion = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { ...text, description: 'Unique lowercase slug; 1–32 characters.' },
    label: text,
    weight: { type: 'number', required: true, description: 'Relative priority 0–100. At least one criterion must have positive weight.' },
    description: { type: 'string', description: 'What a higher utility score means.' },
  },
};
const option = {
  type: 'object', additionalProperties: false,
  properties: {
    id: text,
    label: text,
    scores: { type: 'json', required: true, description: 'Exactly one key per criterion ID. Each value is {value,low,high,basis,note}: 0<=low<=value<=high<=10; basis is measured, estimate, or assumption; note is a required provenance explanation (1–500 characters). Higher is always better, so invert costs/risks. Bounds are possible utility values, NOT probabilities.' },
  },
};

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'decision_lab',
    description: 'Create a local interactive what-would-change-my-mind comparison for 2–8 options against 2–8 criteria. The user can adjust priority sliders, inspect uncertainty, and export a decision brief without extra model calls. Use only user-provided or clearly labeled assumptions: never invent measured evidence. Ask for meaningful priorities and scores when missing. All scores are utility 0–10, higher is better; document how raw measures were converted. Call directly to render a web card; programmatic/nested calls still return analysis but may have no card.',
    parameters: {
      decision: {
        type: 'object', required: true, additionalProperties: false,
        properties: {
          version: { type: 'number', required: true, description: 'Exactly 1.' },
          title: { ...text, description: '1–160 characters.' },
          question: { type: 'string', description: 'The decision to make, up to 1200 characters.' },
          criteria: { type: 'array', required: true, items: criterion },
          options: { type: 'array', required: true, items: option },
          assumptions: { type: 'array', items: { type: 'string' }, description: 'Up to 12 explicit assumptions, at most 500 characters each.' },
        },
      },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: formatReport(value.decision) }],
      presentationMeta: (_args, value) => ({ decisionLab: { version: 1, decision: value.decision } }),
    },
    isConcurrencySafe: () => true,
    async execute({ decision }, exec) {
      exec.signal.throwIfAborted();
      const validated = validateDecision(decision);
      const analysis = analyzeDecision(validated);
      exec.signal.throwIfAborted();
      return { version: 1, decision: validated, analysis };
    },
  }));
}
