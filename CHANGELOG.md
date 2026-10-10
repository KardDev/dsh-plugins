# DSH Motion UI

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
