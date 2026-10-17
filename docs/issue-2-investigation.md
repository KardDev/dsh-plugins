# Issue #2: text outside a rounded shadow card

Report: https://github.com/Scorp1o117/dsh-motion-ui/issues/2

The report contains a screenshot and a comment, with no source document or session export. The original document and exact cause cannot be confirmed from the screenshot alone. The issue remains open pending confirmation.

Reproduced related cases in Web: fixed-height HTML cards overflowing after text wraps, last lines entering rounded bottom corners, and SVG text/tspan extending below a background rectangle.

Normal-flow HTML text cards now grow with their contents and retain the existing shadow. Shorter text can shrink back to the original minimum height. Script-free progressive previews use the same sizing repair. Intentional scrolling/clamping, positioned layouts, preserved-layout regions and motion stages are excluded from automatic reflow. SVG and positioned-layout problems receive bounded cardTextOverflow diagnostics with text locations; the plugin does not rewrite authored drawing coordinates.

Guidance now asks models to preserve shadows and fix container size, padding or text wrapping. It discourages hiding overflow or reducing text to conceal layout faults.

Regression: tests/verify-card-layout.mjs covers geometry, shadow preservation, responsive changes, audits, the actual opaque sandbox bootstrap and the static preview bootstrap. This verifies related failure modes, not the unavailable original document.
