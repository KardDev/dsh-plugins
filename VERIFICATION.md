# Verification

## 0.5.5 — process guide authoring repair (2026-10-10)

61 automated tests and 14 release checks cover the static steps contract, canonicalization before native tool validation, precise error paths and compact failure presentation. Replaying all five original render_ui argument sets from the reported exported session through the registered Host tool succeeds in an isolated temporary DSH_HOME: the first four retain five steps instead of falling back to text. No new model success-rate claim is made. Evidence: test-output/exported-steps-replay.json and test-output/release-verification.json.

PC browser checks at 1920/1365px in light/dark themes verify five ordered steps without invented status labels, compact complete error text, no overflow and no document/state recovery warnings. Evidence: test-output/steps-verification.json and test-output/steps-repair-desktop.png. The original host/iframe timing checks now wait for propagated state; offline-export request counts isolate the exported page from host background diagnostics.


## 0.5.4 — main Web release acceptance (2026-10-10)

Build `0.5.4+92e88973eabc` passes all 59 automated tests and 13 release checks after a clean `npm ci --ignore-scripts` (zero reported vulnerabilities). The main Web profile installs the packed package with all 54 distributed files matching. Its composed configuration validates after migration from the old package name. Actual Home → Plugins settings, saved calculator parameters, reload and downloaded offline HTML pass. Evidence: `test-output/motion054-main-web-smoke.json` and `test-output/release-verification.json`.

Two natural-completion DeepSeek V4.1 Flash Fast trials on the main Web, both in the test workspace, pass in one UI tool call with zero tool errors: an unsolicited static project-tool comparison commits at about 37 seconds via render_canvas, and an explicitly requested adjustable resistor explanation commits at about 30 seconds via render_ui. The resistor trial verifies saved input changes, refresh restoration, and bounds at 1920/1365px in light/dark themes; observed visual audits report no issues, but their contrast coverage is partial. Screenshots were also visually reviewed. Both plain GiB follow-ups use no UI tools and answer correctly. Prompt injection and request model identity are verified. No model output was capped, truncated or cancelled. These individual trials do not establish a general first-attempt success rate. Evidence: `test-output/natural-models/guided-deepseek-v4-1-flash-fast-quick-comparison-web-release054/results.json` and `test-output/natural-models/guided-deepseek-v4-1-flash-fast-explicit-resistor-web-release054/results.json`.

This release retains its Web compatibility declaration. Desktop has a separate installed profile and requires post-publication installation and actual Electron acceptance; Web results alone do not establish Desktop support.

## Unreleased development — forgiving authoring and clean rounded defaults

Development build `0.5.3+89c9850332a7` is distinct from the published 0.5.3 package. All 59 automated tests and 13 release verification steps pass. The packed development installation matches all 54 distributed files in an isolated Web profile; the main Web profile is unchanged.

Browser checks cover Unicode identifiers, inline table data and captions, text metrics, structured checklist state, persistence and standalone export. Default footer disclosures are hidden, optional details update live without losing state, and the compact action menu supports Escape and export. Computed styles confirm rounded corners and gradients. A short canvas shrinks below 120px, grows when 360px of content is appended, then shrinks again when it is removed; the root bottom gap stays within 30px. Evidence: `test-output/authoring-verification.json`, `test-output/authoring-desktop.png`, and `test-output/release-verification.json`.

Actual installed Web acceptance also passes: Home → Plugins saves design mode and the details checkbox across reload, an existing model-authored calculator retains correct calculations and saved values, and the compact menu downloads a working offline HTML copy. Evidence: `test-output/motion-authoring-native-smoke.json`. The smoke harness waits for asynchronous checkbox persistence and reopens the Plugins panel after page reload; initial harness failures were corrected before the successful run.

Natural-completion model trials in the test workspace used the same project-tool comparison question without an explicit UI request. Fast delivered seven nodes in one render_ui call with no tool errors (about 33 seconds); Ling delivered five nodes in one call with no tool errors (about 60 seconds), but its subsequent plain-answer turn ended with an error, so the complete Ling run is not a pass. Those two trials used the earlier native-schema build `6cb03c60f2c8`. MiMo initially selected the advertised legacy JSON-string branch and needed a repair. After exposing only the object form while retaining internal legacy decoding, MiMo on the current build delivered twenty nodes in one call, no tool errors, about 64 seconds to commit, and passed the plain-answer follow-up. These are individual trials, not guaranteed timings or a general first-attempt success rate. No inference was cut off or capped.

## 0.5.3 — lightweight delivery and one answer-area view

55 tests and 12 release checks pass. The new browser regression mounts two native turn-tail seats plus a stale tool preview for the same document in inline mode without a marker: only one committed UI remains. It verifies ownership handoff, saved input restoration, late/removed markers, missing sidebar fallback and independent documents. Four stateless flow/comparison/architecture/dashboard examples render at PC widths without controls or parameter-save chrome.

A natural-completion DeepSeek V4.1 Flash Fast trial, with no UI request in the question, generated a static project-tool comparison with seven nodes, no state and no script. The committed UI appeared at about 31 seconds. The first table submission used invalid inline rows; the model read the catalog and repaired it. This is a successful repaired trial, not a first-attempt pass or guaranteed delivery time. The final prompt and diagnostic now explicitly show the required data reference. A plain GiB follow-up used no UI tools. Inference was neither capped nor cancelled.

## Public release 0.5.2 — DSH Motion UI (2026-10-10)

The renamed package passes 54 tests and all 11 release verification steps against DSH Web 0.2.0-rc.2. An isolated profile installs the packed package with all 50 distributed files matching source. Native PC browser checks confirm the new Home → Plugins settings entry saves settings, legacy Fast-generated documents replay, calculations and saved parameters survive reload, and actual HTML exports activate offline with the new branding. Earlier natural-completion DeepSeek V4.1 Flash Fast tests exercised an explicit bicycle diagram and a proactively generated resistor explanation; model-authored contrast and typography remained uneven in the bicycle case. Desktop support is not claimed. The sections below are historical development evidence.

## 0.5.0 — freeform HTML/SVG animation and shared state

Final delivery is 0.5.1: use getRandomValues for canvas tokens on HTTP LAN hosts, avoid duplicate initial subscriptions, and clear startup timeout errors after a late ready event. Repacking the same 0.5.0 filename/version left the installed client cached; the source hash check detected it. A new patch version is used to make installation unambiguous.

- Added a composable sandbox node for model-authored HTML/SVG, CSS and JavaScript. Standard components retain their bounded schema. Canvas source is never evaluated on the Host or inserted into the Host DOM.
- Opaque-origin iframe, nonce scripts and restrictive resource CSP; source-window/instance checked bridge with declared state/data/derived scopes, atomic validated patches, message/height bounds and rate limit. Preview and failed state restore execute no canvas code. Source/reset changes restart the frame; ordinary parameter changes preserve its identity.
- Host state and derived snapshots drive both native controls and canvas. Existing revision-CAS persistence/recovery is reused. Theme changes propagate; bounded automatic height adapts to narrow screens; reset, stop and runtime-error text fallback remain available.
- Two authored fixtures: a bicycle SVG disassembly explorer with part selection and wheel rotation, and a parameterized sine animation. Both label their illustrative nature. Examples and model guidance are included in ui_catalog.
- 36 unit/integration tests pass. Browser acceptance covers bidirectional controls, derived values, live animation, frame identity, mixed invalid patch atomicity, light/dark/390px layout, reload, reduced motion, reset/stop, runtime errors, selected-data scope and non-executing previews. Parent DOM/cookies/storage access, fetch/images/eval, forged sender and undeclared/out-of-range patches are tested. Expected injected runtime errors are recorded separately from unexpected failures. Evidence: test-output/canvas-verification.json.
- Existing six scenes and progressive preview acceptance pass; eight state recovery/concurrency scenarios pass. Installed Web legacy acceptance replays all three earlier documents, retains saved planner parameters and theme/mobile behavior. Evidence: scenes-stream-verification.json, recovery-verification.json, web-design-verification.json.
- Installed 0.5.0 on DSH Web 0.2.0-rc.2. Actual configured DeepSeek V4.1 Flash generated the bicycle through native render_ui; slider/select/derived updates, mobile bounds and refresh restoration passed. It also authored a new SVG orbit animation solely from a brief, including a moving satellite and native speed/running controls; pixel changes confirm real animation, and reload retains parameters. Evidence: test-output/web-canvas-verification.json, web-canvas-original-orbit.png. Documents: eab3d2dd-cc1e-4ffb-b4b6-ae4d507c4322 and 4aa23acc-5dda-4162-a443-f339a47f3775.
- Native harness initially submitted immediately after an asynchronous New Conversation click, so the original animation was committed to the earlier session while the test waited on an empty page. The harness now keeps both requests in one session. The already-generated documents were replayed and fully checked without another model request.
- Browser debugging evaluation bypassed the eval restriction in an early security probe. The corrected probe executes as actual canvas source at startup and confirms CSP blocks eval. This does not imply CPU/memory hard isolation. Self-navigation can initiate a request before frame shutdown; no credentials or unrelated private data should be exposed to generated code. External dependencies and a canvas Agent action bridge are outside this version.
- Desktop profile untouched. No npm or GitHub publication performed.

Target: DSH Web 0.2.0-rc.2 on Windows; plugin 0.1.2. Desktop profile untouched.

The sections below record successive iterations. Latest installed acceptance targets plugin 0.4.1 on the same Web runtime.

## Automated checks

`npm test`: 16 tests passed, covering bounded declarative schema, arithmetic and dependency cycles, malformed data, unsafe fields, numeric ranges/steps/options, durable state, per-viewed-session isolation, concurrent revision conflict, HTTP input validation, Host tool metadata, conversation replay ownership, HTML escaping, fallbacks, and accessible renderer output.

`npm run build`, `npm run check`, `npm pack`: passed. Installed browser bundle matches the source build SHA256. Web composed configuration validates.

## Real Web / model smoke test

The configured DeepSeek V4.1 Flash model called `ui_catalog` and `render_ui` for the calculator and generated a second comparison UI. No mock tool-result injection was used.

- Slider 4 → 8 changes theoretical pure-weight size 12.57 → 25.15 GiB locally.
- Host saves edited state; browser refresh restores bits=8.
- Follow-up button is accepted through the actual conversation action service. Captured request contains current bits=8 and viewed-session provenance.
- Bar chart and exact accessible data table render with A=12, B=18, C=15 (explicitly demonstration data).
- UI bounds remain inside a 390px viewport. DSH's own narrow-screen sidebar behavior is inherited.
- Fresh unauthenticated context receives HTTP 401 on the state endpoint.
- No browser page errors during the successful smoke run.

Evidence: `test-output/web-smoke-result.json`, calculator/comparison desktop screenshots, mobile screenshot, and final installed verification output.

## Integration corrections found during acceptance

DSH folds work details after a turn completes. The final implementation accumulates standard successful appended tool results into a state-only conversation definition and renders them through `conversation.chat.turnTail`, leaving the tool card as a text summary. The definition's location-data key equals its owned kind, as required by DSH. Follow-ups resolve the scoped service with `scope(id).get("conversation")`.

Rapidly changing an input back to the already-saved value now clears the pending-save message. State is debounced; close the page only after confirmation that parameters were saved.

## Scope limits

Incremental UI streaming is not implemented. Direct native calls support the UI; PTC/composite presentation may fall back to text. State-only removal fallback is covered by standard text output and renderer tests; a live uninstall/reinstall test has not been performed. Model layout quality beyond the supplied component set is not claimed.

Final installed-package check: Web restarted with plugin 0.1.2; both real-model-generated interfaces replayed from history, saved parameters restored, empty numeric draft disabled follow-up, invalid Origin received HTTP 403, and a second refresh preserved both interfaces. No page or conversation subscriber errors. Evidence: `test-output/installed-verification.json`, `final-calculator.png`, `final-comparison.png`.

## 0.1.3 — 汐可酱验收反馈修复

- Follow-up snapshots now carry all current `derived` values from the same bounded interpreter as the renderer, evaluated from complete current state. `stateKeys` continues to select submitted state fields. Values preserve calculation precision; the prompt explains display rounding and asks the model to use supplied results.
- Stateless documents omit the initial-parameters line in new tool text results. Their native explanation also omits the empty parameter block and uses the shorter explanation label. Existing persisted tool-result text is immutable.
- 19 tests pass, including nested derived dependencies (`round`, `if`, `lt`), current versus default state, selected-state filtering, and both text/renderer stateless fallback cases. Build/check/pack pass.
- 0.1.3 installed in the Web profile, composed configuration validates, installed client SHA256 matches source build.

Installed browser feedback acceptance passed: actual calculator button produced a request with `state.bits=8` and `derived.weightGiB=25.14570951461792`, matching displayed 25.15 GiB. Session provenance retained. Stateless comparison explanation contains no empty parameter block. The request was intercepted before reaching the model, so this check created no extra conversation turn. Evidence: `test-output/feedback-verification.json`; no browser page errors.

## 0.2.0 — unified default visual design

- Shared renderer-owned theme tokens, typography, spacing, section cards, metric hierarchy, line icons, switch controls, colored charts/grid/value labels, and internally scrolling mobile charts/tables. Legacy UI documents automatically receive the design.
- Optional fixed icon/tone vocabulary; arbitrary CSS/SVG/color strings remain rejected. Static tones do not infer success from data. Decorative icons are hidden from accessible names.
- Complete initial text projection includes heading/text/card titles, including derived string explanations. Added gt/gte/neq and a third conditional-budget catalog example.
- 22 tests pass; build/check/pack pass. Isolated browser acceptance covers the original recorded planner and four additional fixtures in light/dark/390px, no document overflow, toggle/select operations, and a changing conditional verdict.
- Web profile installs 0.2.0; configuration validates; installed client SHA256 matches build. Visual specification: DESIGN.zh-CN.md. Incremental generation and derived-series charts remain outside this release.

Installed Web visual acceptance passed: all three original UIs replay, the planner's saved inputs remain intact, icons/switch/select are present, native DSH light/dark tokens change metric colors, 390px bounds hold and charts scroll internally, refresh retains the planner. No page/subscriber errors. Evidence: `test-output/web-design-verification.json`, `web-design-calculator-light.png`, `web-design-results-light.png`, `web-design-results-dark.png`, `web-design-results-mobile.png`. Theme changes occurred only in an isolated test browser DOM, not the user's saved appearance setting.

## 0.3.0 — live derived data and state recovery

- Bounded root-level map expressions generate chart/table object rows from static samples plus current state/derived values. Item references stay scoped to row fields; no callbacks or executable code. Limits include 16 fields/map, 500 generated rows total, existing expression/work budgets, and 128 KiB derived output.
- Current chart/metric result types are checked on every recomputation, including conditional type changes. Numeric line x axes preserve uneven sampling distances. Line y axes use the current extent, while bar charts retain zero baselines.
- Restore failures offer retry with inputs disabled; save failures retain drafts and offer retry. Conflicts offer explicit remote adoption or keep-local retry, both using the Host revision protocol. Ambiguous committed writes become conflicts rather than silent overwrites. Edits during in-flight saves are subsequently saved.
- Invalid numeric drafts remain visible on blur. Explicit remote adoption remounts input drafts and clears invalid markers. This also prevents blur-driven layout changes from losing recovery clicks.
- 27 unit/integration tests pass. Isolated React StrictMode + actual UiStore browser acceptance passes eight recovery/data scenarios, including two simultaneous pages, read/write faults, lost commit response, concurrent edits and generated-row followup snapshots. Evidence: `test-output/recovery-verification.json`.
- Build/check/pack pass. Web profile installed version 0.3.0; composed configuration validates; installed client SHA256 matches build. Incremental UI generation remains the next stage.

Real configured-model Web acceptance passed on installed 0.3.0: the model used native render_ui to create the mapped curve. Changing maximum context from 32K to 64K updated the curve, table and theoretical weight-plus-KV metric from 14.86 to 16.36 GiB locally. Refresh restored 64K. The actual follow-up request included the current derived curve and matching total; the request was intercepted before model execution. The 390px layout stayed in bounds, with no browser errors. Evidence: test-output/web-curve-verification.json and test-output/web-live-curve.png.

Legacy Web regression on installed 0.3.0 also passed: all three existing UI documents replayed, saved planner inputs remained intact, icons and toggle/select controls rendered, native light/dark theme colors changed correctly, narrow charts scrolled internally, and refresh retained planner metrics. No page or subscriber errors. Evidence: test-output/web-design-verification.json. Desktop profile was untouched.

## 0.4.1 — progressive preview and six scene designs

- Native preparing views subscribe to the official Tool slot's useToolCallArgumentsPartial hook. The bounded parser admits complete JSON tokens and whole validated top-level subtrees, with stable node IDs. It does not guess incomplete strings/numbers or execute partial expressions. Host success remains authoritative; previews do not read/save input state or send actions.
- Six authored layouts: dashboard, workbench, comparison, guide, status, report; five fixed theme accents; comfortable/compact density; outline/soft/featured card surfaces. Defaults preserve existing documents. Action colors use darker fixed scene colors to maintain white-label contrast in both themes.
- Added badge, numeric progress, ordered steps and collapsible details. Text fallback retains their contents. Progress validates its current range on every recomputation. Step statuses are explicit declared snapshots, not live Host task subscriptions; examples are visibly demonstrations.
- 32 unit/integration tests pass, including every character prefix of a streamed calculator, escaped JSON text, incomplete containers, forward references, resource limits, scene validation, dynamic progress bounds, accessible markup, disabled previews and failed-result cleanup.
- Isolated React StrictMode browser acceptance passes all six designs in light/dark/390px, no page overflow or browser errors; checks local workbench interaction, collapsible details, stable preview DOM identity, zero preview state requests, cancelled-result cleanup and activation only after commit. Evidence: test-output/scenes-stream-verification.json, scene-gallery.png and scene-*-light/dark/mobile.png.
- State recovery browser regression passes the existing eight fault/concurrency scenarios, with no errors. Actual Web legacy regression on 0.4.0 replayed all three original documents, retained saved planner values, theme inheritance and narrow-screen layout. Evidence: test-output/recovery-verification.json and test-output/web-design-verification.json.
- Native acceptance initially used an overly broad data-preview selector that also matched DSH's thinking summary, causing false missing-preview assertions. The harness now scopes observation to data-dsh-generative-ui. A real configured-model run observed seven distinct completed-subtree previews, with no enabled preview controls. This is not a guarantee of per-token display: cadence still depends on upstream chunking and document field order. Incomplete nested cards and arbitrary patches to committed documents remain outside this release.

Final installed 0.4.1 real configured-model acceptance passed: seven sequential native preview stages, controls disabled until Host success, actual status/compact/teal layout, badges, dynamic progress and counts (72 to 80 processed, 20 remaining), steps, collapsible details, correct teal action button, 390px layout and refresh restoring processed=80. No page/subscriber errors. Evidence: test-output/web-stream-verification.json, web-stream-status.png, web-stream-status-mobile.png. Installed client SHA256 matches the source build; Web composed configuration validates; Desktop remains untouched. Build/check/pack pass. No npm or GitHub publication was performed.

Final 0.5.1 installed verification: configuration validates; client.js, index.js, README.md, lib/sandbox.js and lib/catalog.js hashes match source. Web restarted as PID 69728. Both saved native canvases replay, animate, synchronize controls and restore state; all three legacy documents replay with saved parameters. Final browser reports show version 0.5.1 and no unexpected page/subscriber errors. The Desktop profile is untouched.

## 0.5.2 — injected design skill and canvas polish

- Packaged `skills/intelligent-ui/SKILL.md` is actively injected through three DSH system-prompt sections: design skill with the shared canvas guide, full shared protocol, and two minimal valid calculator/animation examples. The model does not have to discover the catalog first. Public OpenUI, Diagram Design and Taste Skill ideas are adapted to DSH; no claim of copying OpenAI private instructions.
- Candidate build `0.5.2+34a575d0923e` passed exact full-section matching in the real model-visible durable `system/message`. A fresh configured DeepSeek V4.1 Flash Medium conversation generated original radar HTML/SVG/CSS/JavaScript directly through render_ui, without a ui_catalog call. Native speed/run controls, actual SVG movement/pause, light/dark/390/768/desktop bounds and refresh replay passed. The mobile screenshot has readable HTML captions outside the SVG. Evidence: `test-output/skill-injection-verification.json`, `skill-radar-mobile.png`.
- Shared component attribute definitions drive validation and capability discovery. Targeted catalog topics avoid fourteen-example context dumps. Original six-scenario visual guidance covers composition, diagram relationships, hierarchy, themes, responsive labels and truthful data. Architecture and scatter examples add distinct compositions, keyboard interaction and shared derived data.
- Canvas loading, folded operations, friendly errors with folded debug details, reset/stop/recovery are covered. DSHUI.animate pauses offscreen/background and supports a static reduced-motion callback. Existing raw requestAnimationFrame programs are not automatically rewritten. Runtime faults cannot be hidden by a subsequent valid patch.
- 36 unit/integration tests passed; the complete local release runner passed. Browser acceptance also executes both always-injected examples and covers canvas isolation, stable frame identity, atomic invalid mixed patches, six scene layouts, streaming cancellation, and eight persistence/concurrency fault cases. Installed 0.5.2 candidate replay of bicycle/orbit plus all three legacy documents passed with no unexpected browser errors.
- Separate real-model pendulum acceptance first exhausted output tokens at Max before submitting a canvas. With a concise continuation and Medium for that verification session only, it completed in about 52 seconds; an invalid string arithmetic expression was rejected and self-repaired. Both motion and recovery tests passed, but scaled mobile SVG labels were small. The injected skill now explicitly recommends actual rendered text sizes and HTML captions; model design quality remains variable.
- Candidate configuration and installed source/skill hashes validate against Web 0.2.0-rc.2; Desktop is untouched. Final installed reports are generated under `test-output/` after the complete package is installed. No external npm or GitHub publication.

## 2026-10-09 development batch — version remains 0.5.2

- Added injected complexity/repair guidance, bounded single JSON-string decoding at the tool boundary, inspect_ui, revision-checked patch_ui, latest-document hydration, and bounded client display observations. Native auxiliary type now has a 12px minimum. Original release archive is retained separately; these additions are development builds.
- Final local build `0.5.2+a65d502922e2` passes 41 unit/integration tests and all eight release-runner steps. Browser acceptance covers actual rendered SVG size, unnamed controls, known solid-background contrast, revision conflicts, atomic invalid patches, preserved live frames/details/parameters, code replacement and latest-revision refresh. Existing canvas, six-scene, streaming and eight recovery scenarios also pass. Evidence: `test-output/release-verification.json`, `refinement-verification.json`.
- Real model generation used build `0.5.2+a33ef9cff055`; the later build only increases native auxiliary font sizes. All three conversations have verified cwd `J:\测试结果`, actual model IDs, and exact full matching of the three injected sections in the durable model-visible system message. Each ran the same calculator, original ellipse animation and text-only refinement tasks, strictly sequentially. All nine cases passed without tool errors or browser page errors. No new native tests ran in Workspace.

| Actual model | Provider | Calculator | Original animation | Inspect + refine |
| --- | --- | --- | --- | --- |
| xiaomi/mimo-v2.5 | commandcode | 33s | 72s | 104s |
| inclusionai/ling-3.1-flash:free | commandcode | 64s | 90s | 35s |
| step-5-preview-free | opencodego-ui-test | 34s | 42s | 20s |

All selected High effort. These single-run wall times include provider response, tool steps and browser checks; they are not pure token throughput or a stable model ranking. Prompts specify the task, states and constraints; this is guided functional acceptance, not proof of arbitrary autonomous design quality. MiMo's initial mobile SVG labels measured about 7px despite functional success. Ling and Step placed key captions outside SVG; visual quality is evaluated separately from functional pass.

- Provider compatibility: the original OpenCodeGO Responses configuration rejected MiMo with ModelProtocolUnsupported before inference. MiMo/Ling acceptance uses the existing commandcode provider. Step uses a clearly named isolated Chat Completions test alias, matching the official OpenCodeGO endpoint documentation; original providers remain unchanged. No credentials are included in evidence.
- Invalid early batches remain documented: JSON string tool fields initially failed plugin validation and were fixed at the boundary; parallel new-task creation reused one DSH draft and mixed model selections, so that batch was discarded. Final results use new sequential sessions and verified actual model identity. Old failure screenshots in each folder are historical, not failures of the final batch.
- Evidence: `test-output/model-matrix/summary.json`, per-model `results.json`, mobile/desktop screenshots and `observations.json`; final installed package hashes/replay are recorded separately in `installed-development-files.json` and `model-matrix/installed-replay.json`. Display reports include their observed revision; old revision snapshots do not certify the current UI. Desktop and external npm/GitHub publication are outside this batch.
- Separate MiMo display-repair acceptance passed: it inspected the real 390px report and patched its own canvas. The original 7px SVG label warnings disappeared at revision 2; animation, speed=2, paused state and refreshed parameters survived. This took about 242s including browser checks, showing a latency limitation rather than universal quick repair. Evidence: `model-matrix/mimo-v2-5/visual-repair.json`, `visual-repair-mobile.png`. The initial native 11px auxiliary warning is addressed by the final renderer font change, separately verified locally.
- Model selection also updates DSH's global default. The original entry observed before this user turn's tests (DeepSeek V4.1 Flash, Medium) is restored; each test conversation retains its own model. Original provider configurations were compared without exposing credentials. The named Step Chat test alias is retained. Evidence: `model-matrix/config-restoration.json`.

