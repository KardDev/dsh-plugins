import React, { useMemo, useState } from 'react';
import { validateDecision, analyzeDecision } from '../lib/engine.js';
import { changeWeight } from '../lib/ui-state.js';
import { buildExport } from '../lib/export.js';
import { CSS } from './styles.js';

export const inject = ['slots'];
const pct = value => `${(value * 100).toFixed(1)}%`;
const score = value => value.toFixed(2);

export function DecisionCard({ decision }) {
  const initial = useMemo(() => Object.fromEntries(decision.criteria.map(c => [c.id, c.weight])), [decision]);
  const [weights, setWeights] = useState(initial);
  const [error, setError] = useState('');
  const analysis = useMemo(() => analyzeDecision(decision, weights), [decision, weights]);
  const labels = Object.fromEntries(decision.options.map(option => [option.id, option.label]));
  const modified = decision.criteria.some(c => weights[c.id] !== c.weight);
  const adjust = (id, value) => {
    try { setWeights(changeWeight(weights, id, value)); setError(''); }
    catch (error) { setError(error.message); }
  };
  const download = format => {
    let url;
    let anchor;
    try {
      const payload = buildExport(decision, weights, format);
      url = URL.createObjectURL(new Blob([payload.text], { type: payload.mime }));
      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.filename;
      document.body.append(anchor);
      anchor.click();
      setError('');
    } catch {
      setError('Download could not start. Check browser download permissions and try again.');
    } finally {
      anchor?.remove();
      // Let the browser consume the URL before releasing its backing Blob.
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  return <section className="ddl" aria-label={`Decision Lab: ${decision.title}`}>
    <style>{CSS}</style>
    <header className="ddl-header">
      <span className="ddl-kicker">DECISION LAB <span> / </span> WHAT WOULD CHANGE MY MIND?</span>
      <h2>{decision.title}</h2>
      {decision.question && <p>{decision.question}</p>}
    </header>
    <div className="ddl-summary" aria-live="polite" aria-atomic="true">
      <span className="ddl-muted">{analysis.leaders.length > 1 ? 'Tied at these priorities' : 'Leading at these priorities'}</span>
      <strong data-testid="leader">{analysis.leaders.map(id => labels[id]).join(' / ')}</strong>
      <p>{analysis.robustWinner ? 'Its lower bound exceeds every alternative’s upper bound at these priorities.' : 'The supplied ranges do not establish a clear winner. Check the assumptions before deciding.'}</p>
    </div>
    <div className="ddl-workbench">
      <section className="ddl-priorities" aria-label="Priorities">
        <div className="ddl-section-title"><h3>Your priorities</h3><button type="button" className="ddl-text-button" onClick={() => { setWeights({ ...initial }); setError(''); }}>Reset</button></div>
        <p className="ddl-muted">Relative weights. Shares normalize automatically.</p>
        {decision.criteria.map(c => <label key={c.id} className="ddl-slider">
          <span><b>{c.label}</b><output>{pct(analysis.weights.find(w => w.id === c.id).share)}</output></span>
          <input type="range" min="0" max="100" step="0.1" value={weights[c.id]} aria-label={`${c.label} weight`} aria-valuetext={`${weights[c.id]} relative weight`} onChange={event => adjust(c.id, Number(event.target.value))} />
          {c.description && <small>{c.description}</small>}
        </label>)}
        {error && <p className="ddl-error" role="alert">{error}</p>}
        <p className="ddl-session-note">{modified ? 'Unsaved scenario' : 'Original priorities'} · Slider changes stay on this card until it is closed or reloaded. The assistant does not see them.</p>
      </section>
      <section className="ddl-results" aria-label="Option ranking">
        <h3>Options under pressure</h3>
        <p className="ddl-muted">Weighted utility out of 10 · band = supplied low–high range</p>
        <ol className="ddl-ranking">
          {analysis.ranking.map((row, index) => <li key={row.id} data-option={row.id}>
            <div className="ddl-rank-heading"><span className="ddl-rank-number">{String(index + 1).padStart(2, '0')}</span><b>{row.label}</b><strong>{score(row.score)}<small> / 10</small></strong></div>
            <div className="ddl-track" aria-hidden="true"><span className="ddl-band" style={{ left: `${row.low * 10}%`, width: `${(row.high - row.low) * 10}%` }} /><span className="ddl-dot" style={{ left: `${row.score * 10}%` }} /></div>
            <div className="ddl-range"><span>{score(row.low)}–{score(row.high)}</span><span>{row.dominatedBy.length ? `Point-score dominated by ${row.dominatedBy.map(id => labels[id]).join(', ')}` : analysis.leaders.includes(row.id) ? 'Current leader' : 'Alternative'}</span></div>
          </li>)}
        </ol>
      </section>
    </div>
    <section className="ddl-switches" aria-label="Sensitivity analysis">
      <h3>What would change the result?</h3>
      <p className="ddl-muted">One priority at a time, holding scores fixed. Other priorities keep their relative proportions.</p>
      <ul>{analysis.sensitivities.map(s => <li key={s.criterionId}><b>{s.label}</b><span>{s.nearestFlip ? <>At a <strong>{pct(s.nearestFlip.share)}</strong> share, <strong>{s.nearestFlip.leaders.map(id => labels[id]).join(' / ')}</strong> takes the lead.</> : 'No different leader on the sampled grid.'}</span></li>)}</ul>
      <small>Closest sampled change, not an exact threshold. Grid: 0–100% in 1 percentage-point steps. If the other priorities are all zero, their remainder is split equally.</small>
    </section>
    <details className="ddl-evidence">
      <summary>Inspect scores, evidence and assumptions</summary>
      <p>All inputs are utility scores: higher is better. Evidence labels are supplied by the author and are not independently verified.</p>
      {decision.options.map(option => <section key={option.id}><h4>{option.label}</h4><dl>{decision.criteria.map(c => {
        const cell = option.scores[c.id];
        return <div key={c.id}><dt>{c.label} <span>{cell.value} [{cell.low}–{cell.high}] · {cell.basis}</span></dt><dd>{cell.note}</dd></div>;
      })}</dl></section>)}
      {!!decision.assumptions?.length && <><h4>Assumptions</h4><ul>{decision.assumptions.map((value, i) => <li key={i}>{value}</li>)}</ul></>}
    </details>
    <footer className="ddl-footer"><strong>Decision aid, not a prediction.</strong><ul>{analysis.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      <div className="ddl-exports"><button type="button" onClick={() => download('markdown')}>Export Markdown</button><button type="button" onClick={() => download('json')}>Export JSON</button></div>
    </footer>
  </section>;
}

export function ToolView({ phase, block }) {
  if (phase === 'preparing' || phase === 'start') return <p role="status">Preparing Decision Lab…</p>;
  const fallback = Array.isArray(block?.content) ? block.content.filter(c => c?.type === 'text' && typeof c.text === 'string').map(c => c.text).join('\n') : '';
  if (block?.isError) return <div role="alert"><strong>Decision Lab could not analyze these inputs.</strong><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{fallback}</pre></div>;
  try {
    const raw = block?.meta?.decisionLab;
    if (raw?.version !== 1) throw new Error('Unsupported metadata');
    const decision = validateDecision(raw.decision);
    return <DecisionCard key={`${block?.id ?? ''}:${JSON.stringify(decision)}`} decision={decision} />;
  } catch {
    return <div><p>Decision Lab: text result (no compatible card data).</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{fallback || 'No result available.'}</pre></div>;
  }
}

export function apply(ctx) {
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'decision_lab' }, ToolView));
}
