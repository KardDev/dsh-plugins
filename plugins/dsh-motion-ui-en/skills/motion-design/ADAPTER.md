# Motion UI host adaptation

Read this adapter together with the complete, unmodified upstream SKILL.md. Apply its full art direction, choreography, typography, visual grammar, sound planning and quality guidance. This adapter maps OpenDesign-specific execution details to the actual DSH host; it does not replace the design craft with a summary.

## Host contract takes precedence

- User requirements and the current DSH host permissions, tools and task scope govern execution. The upstream OD Core, stage markers and CLI paths are OpenDesign references, not additional tools or instructions to install OpenDesign.
- User-requested films require an actual MP4 and editable source. Interactive explanations remain runnable UI; loading this reference alone does not request a video.
- Upstream fixed inspection/repair counts are OpenDesign orchestration defaults. In this host they do not cap model reasoning, output, time or necessary defect repair. Never cancel inference to satisfy those counts. Stop when the requested result is verified or report a real unresolved failure.
- Keep the user's actual reference, approved copy and chosen material language. Free mode leaves visual authorship to the model; guided mode uses the chosen style unless the user supplies a specific overriding direction. Honor explicit material exclusions; do not introduce glass as a default material.

## Execution mapping

| OpenDesign reference | Motion UI execution |
| --- | --- |
| Scaffold / HyperFrames HTML | `render_canvas` saves an isolated HTML/CSS/script document. Use one unique `#stage`, designed at the actual output aspect. |
| `window.__timelines.main` / GSAP clock | `DSHUI.timeline({id:'main',duration,draw(time,info),chapters})`. Seconds are the first argument. Acquire Canvas2D context yourself; e.g. `const ctx=canvas.getContext('2d');` and `draw(t){drawFrame(ctx,t)}`. |
| `data-width`, `data-height`, `data-fps`, `data-duration` | Keep source dimensions, timeline duration and `preview_video` / `render_video` arguments consistent. Scale the authored composition uniformly. |
| OD source player | Connect controls outside `#stage` to the same DSHUI timeline. Exported standalone source already synchronizes its soundtrack. Do not create another playback clock. |
| OD capture flag | `window.__DSHMotionRender` is supplied during capture; the host seeks the registered timeline. Drawing must synchronously reproduce any absolute time. |
| GSAP-specific SVG origin examples | Preserve their design intent with grouped geometry and explicit shared pivots. GSAP is not bundled; arbitrary CDN/network imports and eval are blocked in the canvas. Native SVG, Canvas and transform math work directly. |
| Audio DOM metadata / OD audio policy | `render_video` takes local `audioTracks:[{path,role:'voice'|'music'|'effect',volume,offset,loop,fadeIn,fadeOut}]`. This produces actual mixed audio and bundles source assets. DOM audio tags or Web Audio alone are not exported tracks. |
| Speech / transcript timing | `synthesize_voice` returns real measured timing using configured MiniMax authentication. Narration is optional. Do not invent ASR or claim audio analysis from an arbitrary pulse. |
| OD media generation / wait | `preview_video` returns actual source frames and diagnostics; read its images before encoding. `render_video` exports the MP4 and project ZIP. `inspect_video` checks existing media and samples decoded frames. `process_video` handles clips and soundtrack changes. |
| Modify existing composition | `inspect_ui` then `patch_ui` with current documentRevision; `update_ui` for structural changes. Do not create duplicate documents for a repair. Editing an exported HTML snapshot alone does not update the saved rendering input. |

## Reliable drawing and review

- For Canvas, save/restore local drawing state; derive transformations and all values from time. Seed/cache texture rather than regenerating unrelated random marks.
- Gate flash/mask opacity to its active interval. An inverse clamped fade equals 1 before the fade begins; explicitly keep overlays transparent outside their intended interval.
- Inspect the opening, focal transformation, readable hold, transition hand-off and ending. Check actual label bounds, contact points and data units at intended resolution. Sparse frames are not a full perceptual/audio review.
- A successful capture proves valid execution, not design quality. If an unexpected blank is present in both the source preview and a decoded MP4 at the same time, inspect authored masks and time conditions before blaming the renderer.
- Preserve inputs, earlier films and editable assets. Cite supplied/downloaded media accurately and include required credits; never invent assets, screenshots, rights or measurements.

The unmodified upstream skill, provenance and Apache-2.0 license are shipped alongside this adapter.
