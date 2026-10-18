# Issue #3: document shell geometry under external CSS

Report: https://github.com/Scorp1o117/dsh-motion-ui/issues/3

The reporter runs DSH 0.2.1-rc.2 with a skin called orca-link and describes zero-radius document shells. The report confirms that scoped important radius declarations restore their layout. No complete custom skin CSS or exported failing document was attached.

Live rc.2 Web without this skin computes the original intended radii: prismframe 24px, soft 30px, technical 10px, expressive 20px, aurora 28px, editorial 0px. This does not establish a host-version regression. A generic important section reset reproduces the zero-radius symptom; a generic div decoration also creates an unwanted portal shell.

The plugin now owns a narrowly scoped shell-radius boundary. A dedicated shell token preserves the existing style geometry, with an explicit 16px fallback for unstyled native documents. Reading/minimal remain unframed. Settings previews are excluded. Marker-created portal seats have an owned class and reset only decoration (border, background, shadow, padding and radius). The patch does not reset arbitrary conversation elements, card contents, model HTML/SVG, or the iframe document.

`tests/verify-host-boundary.mjs` checks 576 combinations: six styles, eight presets, three widths, light/dark, and skin-first/skin-last, at device scale 1.5. It reproduces the pre-fix 0px shell using the same stylesheet without the new boundary, and verifies restored style-specific geometry, transparent marker seats, inner card shadows, unchanged iframe-authored button geometry, free-mode fallback and preview exclusion. The real PresentationView/marker regression additionally proves iframe identity and saved inputs survive a hostile style insertion.

Issue #2 is separate: the reporter confirmed its 0.8.4 fix in issuecomment-6234732381 and in #3. A verified resolution comment was posted before closing #2 as completed.

Desktop was not modified or restarted in this round. The exact orca-link stylesheet remains unavailable, so do not claim the reporter's full environment has been directly reproduced.

## Follow-up: internal component geometry (unreleased Web build)

The reporter confirmed the 0.8.5 document shell fix in issuecomment-6245207297, but reported zero-radius internal cards, metrics, controls and other surfaces. The supplied orca-link CSS was extracted verbatim from that comment for local checks (SHA256 e172fad835d769227b5beb0a1310991f73d81db77894496d6b5c80bc8f85a3f4). Its only radius declaration targets the logo-row pseudo-element. Loading that stylesheet alone does not reproduce the internal reset; the actual overriding rule or failing document is still needed. A read-only diagnostic and request for the original document were posted in issuecomment-6245496022. Keep #3 open.

The Web fix extends the owned boundary to native cards, metrics, controls, charts, table wrappers, form fields and the iframe element. Trusted plugin CSS records its own per-element radius declaration in a private token; the final priority guard uses that token. This preserves asymmetric, nth-child, responsive, zero-radius and free-mode geometry rather than assigning a universal 20px. Nodes without a radius declaration retain CSS's initial zero instead of inheriting the parent shell radius. The original radius variables are isolated behind owned per-style values so an external legacy-variable reset cannot flatten internal surfaces. Model-authored iframe CSS and settings previews remain unchanged.

`tests/verify-internal-boundary.mjs` checks 1,728 combinations using the supplied complete skin, both loading orders, all six styles/eight presets, three widths, both themes, and no reset / important radius reset / legacy-variable reset. It additionally checks free mode, previews and authored iframe content. The real portal test checks internal geometry, iframe identity and saved inputs under overrides. All 149 unit/integration tests and 29 build/browser groups passed. This is a local Web test build, not a new npm or GitHub release; Desktop remains unchanged. Passing these cases does not establish the source of the reporter's original override.

## Confirmed source: skin-center patches

In [issuecomment-6246719039](https://github.com/Scorp1o117/dsh-motion-ui/issues/3#issuecomment-6246719039), the reporter identified the actual injected rule:

```css
html[data-dsh-skin="orca-link"] [data-chat-flow] *,
html[data-dsh-skin="orca-link"] [data-chat-flow] ::before,
html[data-dsh-skin="orca-link"] [data-chat-flow] ::after {
  border-radius: 0px !important;
}
```

The diagnostic confirms the existing inner radius variable is 20px; it is the important declaration from skin-center's patches stylesheet that forces the computed radius to zero. The supplied skin.css alone was therefore insufficient to reproduce the conflict.

The regression now applies the exact reported selector with the matching HTML skin attribute and chat-flow ancestor. It reproduces zero-radius cards without the internal boundary and passes 2,304 combinations with the local fix, including the original generic reset and legacy-variable reset cases. The actual installed Web build 0.8.5+f92961c885f0 additionally passes 12 exact-rule cases across six styles and two themes, preserving iframe identity. No production-code change was needed after this evidence: the existing unreleased internal boundary already handles the reported rule. This confirms the CSS conflict and its local fix; it is not confirmation from the reporter's full runtime. Issue #3 remains open pending a published fix and reporter validation. Desktop remains untouched.
