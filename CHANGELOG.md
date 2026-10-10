# DSH Motion UI

## 0.5.4 — 2026-10-10

- Publish a native object schema for render_ui, including the document skeleton and component vocabulary. Legacy JSON strings are decoded internally; models are no longer offered a string branch that encourages double escaping.
- Accept JSON fences/trailing commas outside strings without guessing malformed quotes or executing source. Errors identify the failed field and JSON location where available.
- Support string/boolean metrics, optional table captions, inline table/chart rows, scoped row shorthand, and Unicode identifiers consistently across formulas, maps and references.
- Add bounded structured JSON state for canvas checklists/objects, preserving arrays and objects through persistence and standalone export. A string state with a structured default and no options is canonicalized to json; native inputs still require scalar state.
- Default to a clean view: hide footer diagnostics, history, parameter status and original-description disclosures. Home → Plugins offers optional details. Canvas actions use a compact menu; charts expose data through a title-row button.
- Use rounder surfaces and soft theme-aware gradient fills. Committed, preview and exported canvases fit content height rather than keeping a 160px minimum; filtering can shrink them again.

## 0.5.3 — 2026-10-10

- Prefer lightweight static diagrams, concise comparisons, short processes and compact dashboards; controls and animation are added when useful.
- Inject static flow/comparison examples before the calculator, and add `ui_catalog({topic:"quick"})` with four short layouts.
- Add reusable theme-aware flow/node/arrow/callout styles; static views omit parameter-save status and use the broader “可视化” label.
- Elect one answer-area owner per document when multiple tail seats mount, and retire stale tool previews once the committed UI is available. Missing, late or removed inline markers retain a single fallback view. Explicitly opened sidebars remain separate views.

## 0.5.2 — 2026-10-10

First public release for DeepSeek Harness Web 0.2.0-rc.2.

- Native interactive components, six scene layouts, theme-aware colors and icons.
- Freeform HTML/SVG/CSS/JavaScript canvases in an isolated iframe, with local controls and animation.
- Guided and free design modes; guided mode injects design skills, protocol and worked examples into model context.
- Static streaming previews, persisted parameters, shared derived calculations and contextual follow-ups.
- Answer-tail, inline marker and PC sidebar presentation; revision history, inspection and targeted refinement.
- Single-canvas standalone HTML export carrying current parameters and local calculations.

Validation: 54 automated tests, 11 release checks, and natural-completion DeepSeek V4.1 Flash Fast trials. Model-authored typography and contrast still vary; diagram precision and generated program correctness require review. Standalone export excludes surrounding native UI controls. External libraries/resources and direct host access are unavailable in canvases. Desktop compatibility is not claimed.

Development migration: uninstall `dsh-generative-ui` before installing `dsh-motion-ui`. Legacy storage, tool result metadata and route identifiers remain compatible; configure design/display modes again in the new plugin entry.
