# Decision Lab

**What would change your mind?** Turn a recommendation into an interactive, inspectable comparison instead of a confident paragraph.

Decision Lab adds a `decision_lab` tool and a web tool card to DeepSeek Harness. Move priority sliders and watch the ranking change; inspect the nearest sampled priority change that favors a different option; expose uncertain scores and their provenance; export the scenario you actually chose.

- **Local exploration:** slider changes run entirely in the browser. No additional LLM calls, API keys, telemetry, or network requests.
- **Honest uncertainty:** every score has low / central / high values and an explicit `measured`, `estimate`, or `assumption` label with a provenance note.
- **Counterfactual priorities:** a one-at-a-time sensitivity scan asks which change could favor a different option.
- **Portable decisions:** download the current scenario as JSON or a Markdown decision brief.
- **Replayable original:** DSH stores the original card data in the tool result. Slider edits are deliberately ephemeral and are **not** sent to the assistant; export them before closing/reloading.

This is a decision aid, not a forecasting model or a substitute for professional judgment. There is no claim that its inputs are factually verified or that its result is objectively optimal.

## Install from this repository

Use Node >=22.19. From the repository root:

```sh
pnpm install
pnpm --filter dsh-decision-lab build
dsh plugin --profile web add ./plugins/dsh-decision-lab
```

Replace `web` with your actual profile. Restart the DSH host and reload its page. The package includes a prebuilt `client.js`; install from the subdirectory, **not** the repository root. This package has not been published to npm.

The tool adapter is integration-tested against `@deepseek-ai/dsh-tools@0.2.1-rc.2`, `0.2.1-rc.3` and `0.2.1-rc.5`; development dependencies target `rc.5`. DSH is in preview; other versions are **not claimed compatible**. Tests exercise the real tool registry and Chromium rendering through a small demo slot adapter, not a complete installed DSH web/desktop application.

## Try it

In DSH, the card lives in the tool work details. After the reply completes, expand **Completed in …** and then **Asked questions and called tools**. The Decision Lab card contains the sliders and export buttons; the assistant's final prose is a separate summary. You can reopen the card from an existing successful call without running the model again.

Ask DSH:

> Use Decision Lab to compare a fast launch with a careful pilot. Ask me for the criteria, priorities, and score ranges you need. Clearly label assumptions and explain how any raw measurements become 0–10 utility scores.

For a completely fictional demo, use [`examples/launch.json`](examples/launch.json) as the tool's `decision` argument. Do not present its numbers as measured business evidence.

### Input

```json
{
  "decision": {
    "version": 1,
    "title": "Choose a launch strategy",
    "criteria": [
      {"id": "speed", "label": "Speed", "weight": 70},
      {"id": "care", "label": "Confidence", "weight": 30}
    ],
    "options": [
      {"id": "fast", "label": "Fast launch", "scores": {
        "speed": {"value": 9, "low": 8, "high": 10, "basis": "assumption", "note": "Fictional illustrative utility, not a measured timeline."},
        "care": {"value": 3, "low": 2, "high": 4, "basis": "assumption", "note": "Fictional illustrative utility."}
      }},
      {"id": "pilot", "label": "Careful pilot", "scores": {
        "speed": {"value": 4, "low": 3, "high": 5, "basis": "assumption", "note": "Fictional illustrative utility."},
        "care": {"value": 9, "low": 8, "high": 10, "basis": "assumption", "note": "Fictional illustrative utility."}
      }}
    ],
    "assumptions": ["All numbers are fictional; replace with defensible inputs."]
  }
}
```

Higher scores must **always mean better**. For cost, risk, time, or other lower-is-better measures, convert to a consistent utility scale first and explain the mapping in `description` / `note`. The tool does not infer or fetch missing scores.

### Validation limits

| Input | Contract |
|---|---|
| Criteria / options | 2–8 each; unique IDs within each group |
| IDs | Lowercase letter then lowercase letters, digits, `_` or `-`; at most 32 characters; prototype-related names refused |
| Title / labels | 1–160 characters |
| Optional question | 1–1200 characters |
| Optional criterion description | 1–500 characters |
| Weights | Finite 0–100; positive total |
| Scores | Every criterion exactly once; finite `0 <= low <= value <= high <= 10` |
| Provenance | Required `basis` plus nonempty `note` up to 500 characters |
| Optional assumptions | Up to 12 strings, 1–500 characters each |
| Payload | Lossless JSON, at most 65,536 UTF-8 bytes |

Unknown fields, missing cells, numeric strings, non-finite values and malformed historical card metadata are not silently repaired.

## How analysis works

1. Normalize the nonnegative weights to shares summing to one.
2. Calculate weighted means of central, low and high utility scores separately.
3. Rank by central score. Ties within `1e-9` are reported together.
4. Mark point-score domination only if another option is at least as good on **every** criterion and strictly better on at least one, including criteria whose current weight is zero.
5. Report a robust winner only if a unique leader's lower bound exceeds **every** alternative's upper bound by more than `1e-9` at the selected priorities. This is conditional on the supplied ranges, not a real-world guarantee.
6. For each criterion, sample shares from 0% to 100% in one-percentage-point steps. Rescale the others proportionally; if their total is zero, distribute the remainder equally. Report the closest sampled share with none of the original leaders still leading. Equal-distance changes choose the lower share.

**Limits:** weighted additive scoring assumes commensurate utility scales and does not model criterion interactions or correlations. Range endpoints are not confidence intervals, probabilities, or forecasts. The scan changes weights, not scores; it is not an exhaustive multidimensional search. A narrow winning region between grid samples can be missed. “No different leader on the sampled grid” does not prove stability. `measured` is an author-supplied label, not independent verification. Dominance uses point estimates, not a proof under uncertainty.

## Privacy and lifecycle

Runtime code does not read files, execute commands, open URLs, use localStorage, or create HTTP endpoints. Exports occur only on a button click, as browser downloads. Text and provenance notes render as escaped text, never HTML or clickable external URLs. The original inputs/results follow DSH's normal session storage and model-context handling; **do not put secrets in the tool arguments**. No separate plugin database is created. Unloading the Cordis plugin unregisters the tool.

Exports preserve the original decision, the current weight overrides and recomputed analysis; the Markdown brief includes provenance and caveats. Downloading a file does not send the changed scenario to the assistant. Feed the exported weights back explicitly if you want a revised model discussion.

## Development and verification

From the repository root:

```sh
pnpm install
pnpm --filter dsh-decision-lab test
pnpm --filter dsh-decision-lab build
pnpm --filter dsh-decision-lab check
# One-time Chromium install (no model credentials needed):
pnpm --filter dsh-decision-lab exec playwright-core install chromium
pnpm --filter dsh-decision-lab test:browser
pnpm --filter dsh-decision-lab demo
```

The demo is written to `plugins/dsh-decision-lab/artifacts/decision-lab-demo.html` and opens offline. It uses fictional inputs, a real DSH tool-registry result, the packaged browser module and a clearly identified slot adapter. It is not proof of full DSH application installation.

Tests cover the analysis engine, strict validation, sensitivity, export content, real DSH registry execution and disposal, module packaging, and browser interaction / replay / fallback. See [VERIFICATION.md](VERIFICATION.md) for executed results and known baseline failures elsewhere in the repository.

Runtime entry points: `index.js` (host), `client.js` (generated browser module), `lib/engine.js` (shared pure calculations). Edit `src/client.jsx` and `src/styles.js`, then rebuild; do not hand-edit `client.js`.

MIT licensed. Original implementation; no code copied from the motion UI plugin.
