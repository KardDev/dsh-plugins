# Issue #3: document shell geometry under external CSS

Report: https://github.com/Scorp1o117/dsh-motion-ui/issues/3

The reporter runs DSH 0.2.1-rc.2 with a skin called orca-link and describes zero-radius document shells. The report confirms that scoped important radius declarations restore their layout. No complete custom skin CSS or exported failing document was attached.

Live rc.2 Web without this skin computes the original intended radii: prismframe 24px, soft 30px, technical 10px, expressive 20px, aurora 28px, editorial 0px. This does not establish a host-version regression. A generic important section reset reproduces the zero-radius symptom; a generic div decoration also creates an unwanted portal shell.

The plugin now owns a narrowly scoped shell-radius boundary. A dedicated shell token preserves the existing style geometry, with an explicit 16px fallback for unstyled native documents. Reading/minimal remain unframed. Settings previews are excluded. Marker-created portal seats have an owned class and reset only decoration (border, background, shadow, padding and radius). The patch does not reset arbitrary conversation elements, card contents, model HTML/SVG, or the iframe document.

`tests/verify-host-boundary.mjs` checks 576 combinations: six styles, eight presets, three widths, light/dark, and skin-first/skin-last, at device scale 1.5. It reproduces the pre-fix 0px shell using the same stylesheet without the new boundary, and verifies restored style-specific geometry, transparent marker seats, inner card shadows, unchanged iframe-authored button geometry, free-mode fallback and preview exclusion. The real PresentationView/marker regression additionally proves iframe identity and saved inputs survive a hostile style insertion.

Issue #2 is separate: the reporter confirmed its 0.8.4 fix in issuecomment-6234732381 and in #3. A verified resolution comment was posted before closing #2 as completed.

Desktop was not modified or restarted in this round. The exact orca-link stylesheet remains unavailable, so do not claim the reporter's full environment has been directly reproduced.
