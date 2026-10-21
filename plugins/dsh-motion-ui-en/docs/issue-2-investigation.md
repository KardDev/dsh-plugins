# Issue #2: text outside a rounded shadow card

Report: https://github.com/Scorp1o117/dsh-motion-ui/issues/2

The report contains a screenshot and a comment, with no source document or session export. The original document and exact cause cannot be confirmed from the screenshot alone. The issue remains open pending confirmation.

Reproduced related cases in Web: fixed-height HTML cards overflowing after text wraps, last lines entering rounded bottom corners, and SVG text/tspan extending below a background rectangle.

Normal-flow HTML text cards now grow with their contents and retain the existing shadow. Shorter text can shrink back to the original minimum height. Script-free progressive previews use the same sizing repair. Intentional scrolling/clamping, positioned layouts, preserved-layout regions and motion stages are excluded from automatic reflow. SVG and positioned-layout problems receive bounded cardTextOverflow diagnostics with text locations; the plugin does not rewrite authored drawing coordinates.

Guidance now asks models to preserve shadows and fix container size, padding or text wrapping. It discourages hiding overflow or reducing text to conceal layout faults.

Regression: tests/verify-card-layout.mjs covers geometry, shadow preservation, responsive changes, audits, the actual opaque sandbox bootstrap and the static preview bootstrap. This verifies related failure modes, not the unavailable original document.

## Follow-up: reporter's detailed native-style reproduction

The reporter confirmed 0.8.3 still exhibits the issue and supplied `ISSUE.md` plus two screenshots in https://github.com/Scorp1o117/dsh-motion-ui/issues/2#issuecomment-6234219252 . These identify a different cause from the earlier HTML/SVG overflow investigation: reading/minimal reset root padding, border, background and shadow, but later style grammars override the reset. Prismframe reintroduces a 4px/6px offset root shadow; aurora reintroduces a root shadow and border. Dark aurora also has a more specific background rule.

The reset is now placed after all style grammars and responsive rules. An equally specific final dark/preview-dark background reset keeps these unframed presets transparent. Inner card shadows, framed presets, typography and component styling remain intact. This is a native stylesheet correction; no model prompt or generated HTML modification is needed.

Regression `tests/verify-reading-shell.mjs` checks 432 combinations: six styles, eight presets, light/dark/preview-dark, and 1920/1365/480 widths at device scale 1.5. It asserts unframed root geometry/transparency/shadow, framed root shadows, and retained inner prismframe card shadows. The test is part of release verification. Native-style, style-grammar and reading browser suites and 149 unit/integration tests also passed. Installed main Web is checked against its actual build and served stylesheet, including leave/return/reload. Desktop is unchanged for this follow-up. No new public release or issue reply has been made.
