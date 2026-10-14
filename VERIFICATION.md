# v0.7.1 发布验证（2026-10-14）

构建 0.7.1+d92c9bf2bf64。

- 补齐锁文件中的 DSH peer 依赖，在独立目录按锁文件安装；安装环境的 npm 脚本 Shell 无法解析 node，改为禁用自动 lifecycle 后显式运行 esbuild 安装验证。依赖安装及审计完成，未改变运行时依赖范围。
- 干净依赖下129项单元/集成测试、24组构建/浏览器回归全部通过，包括新增短场景、定位修改、裁切/空白正反例和截断边界。
- M3.1 Flash High 最终轮4个固定场景通过，零工具报错；模型等待未新增时限、思考或输出限制。此为单轮开发验证，不能概括为所有模型均可首次成功。
- 打包与发布检查结果保存在忽略目录 test-output/release-0.7.1；发布后的registry包与实际运行时将按同一构建核验。
- 下文是历史验证记录，不代表本版本的新测试结果。

# v0.7.0 发布验证（2026-10-13）

本次整合风格系统、全局交互、计算易用性和 Anatomy 机制图解。构建 0.7.0+6adc22f63978。

- 发布构建通过117项单元/集成测试与23组构建/浏览器回归，命令：npm run verify:release（Windows测试环境提供DSH_PLAYWRIGHT路径）。
- 打包检查194个文件，包含新工具、机制库、三个完整案例及相关MIT许可证；排除node_modules、test-output与测试私有日志。
- 在干净目录通过npm安装本地tarball，DSH 0.2.0-rc.2所需peer依赖完整，Host入口可导入，48齿/30rpm机制的初始值与−10rpm计算正确。
- 通过Desktop自身的Electron载体与官方dsh-desktop-host CLI，在隔离Desktop profile完成同一tarball安装，退出码0并重读安装清单。
- 功能开发阶段已在真实Desktop/Web核验194个文件、前后端构建一致、机制参数/行程联动与恢复；M3.1 Flash两组实测零工具报错。版本化发布包将在发布后再次核验registry完整性、官方安装、重启与实际运行时。
- 下文保留此前开发过程与历史验证，不将历史的单次成功、未发布构建或中途报错当成本次最终发布状态。

# v0.6.0 发布验证（2026-10-12）

本次正式发布汇总此前 0.5.6 本地开发批次的功能。下面的未发布说明与构建号均为历史记录；当前发布验证以 test-output/v060-release-verification.log 及正式安装核验为准。

# Verification

## Empty turn and unfulfilled announcement recovery — 2026-10-12

Final candidate 0.5.6+bad69c62ddd4. Two actual failures are retained: the user's screenshot session (reasoning only) and Desktop acceptance attempt afea5106-cb3b-460e-9e6a-d39b39de6517 (a short visible flowchart announcement, no tool call). The latter reproduced after schema simplification, so reduced schema size alone is demonstrably not a complete fix.

- Both 22-event/announcement failure replays now enqueue one deduplicated same-turn completion notice (test-output/m31-two-failures-replay.json). The visible-announcement detector never examines reasoning; it excludes substantive lists, source fences and UI-concept questions. Reminder permits useful plain text, preserves existing UI and respects explicit silence/cancellation/subagents.
- Earlier final Desktop assertion correctly failed because no UI was delivered; that test is not a passing acceptance result. Its event log is test-output/m31-final-events.jsonl.
- Final full regression evidence: test-output/m31-empty-announcement-final-regression.log. Version remains 0.5.6 and nothing is published. Root trigger of the model/provider stop is still unproven; this change fixes observable incomplete-delivery recovery and reduces tool-schema complexity.


## M3.1 reasoning-only regression — 2026-10-12 (unpublished)

Screenshot session 06d45422-6105-4fc1-bb8b-c18148afc264 has one reasoning-only assistant response, no visible answer or tool calls, and provider finish stop. Its MiniMax High / maxTokens=256000 configuration and system prompt size match a successful Desktop trial. A stop finish is not evidence that plugin prompts/schema played no role. The exact trigger remains unproven.

- Fix a proven recovery gap: reasoning-only empty turns previously bypassed feedback. Now one deduplicated same-turn completion notice allows either useful plain text or a suitable UI, without inspecting hidden reasoning, requiring UI, setting inference limits, or retrying cancellation/explicit silence/subagents/existing delivery. Replaying the screenshot's 22 events produces exactly one notice.
- Simplify render_text's native schema from 7176 to 758 characters; keep its direct outer array and exact runtime validation. All strings, nested nodes and component capabilities remain supported. Expanded component unions are no longer duplicated in the tool schema. This is a compatibility improvement, not a proven cause of the original stops.
- Align the stale authoring lifecycle instruction with actual read-only progressive previews and end-of-turn interaction activation.
- Live comparisons in J:\测试结果 used the same MiniMax-M3.1-Flash-Preview High without reasoning/time caps or cancellation: two current Web requests, one current Desktop request, one previously published HEAD request, and two compact-schema requests all actually called rendering tools. Small samples cannot establish a reliability rate or prove a root cause. Reports: test-output/m31-current.json, m31-desktop-baseline.json, m31-old-published.json and m31-compact-schema.json. Early harness visual counts used a selector for extended visuals and are not native-UI acceptance evidence.
- 99 tests pass; 18 verification stages pass in test-output/m31-empty-turn-regression.log. The final lifecycle wording is additionally covered by a fresh build and all 99 tests in test-output/m31-empty-final-unit.log. Final build 0.5.6+9cfd7b980bdd; no publishing or version bump.


## Premature-stop investigation — 2026-10-12 (unpublished)

Session ed7a97be contains three user turns. Turns 1 and 2 end with short promises and no rendering calls; turn 3 calls ui_catalog and fails render_text, then ends with reasoning only. All final stream finishes are provider stop, not length/cancel/error. Tools are available; request configuration is MiniMax-M3.1-Flash-Preview, reasoningEffort=max, maxTokens=256000. No render_ui call exists in the export. This evidence cannot distinguish model behavior from upstream service behavior.

- The original failed render_text arguments now validate unchanged: six nodes, all nine table rows retained. Content aliases and exactly identical text/spans normalize without discarding conflicts; typed native object-row tables retain their column presentation through an extended visual.
- Replaying all 47 exported events yields exactly one same-turn correction notice for the failed-tool/empty-answer ending. Promises without a tool error are addressed by delivery guidance, not forced retry or hidden-reasoning inspection. No reasoning cap, timeout, model configuration change, publishing or version bump.
- 98 unit/integration tests and 18 stages pass in test-output/stopped-delivery-regression.log. After a tool-description clarification, build and host/focused tests pass again in test-output/stopped-delivery-final-tests.log. Final build: 0.5.6+a8c2739fed9b.
- Both Web and Desktop packed files match the final build; authenticated PC browser checks confirm matching client/host builds, local resources, registered feedback hook, native sidebar, read-only scene previews and no page errors (test-output/completion-live/stopped-delivery-profiles.json).


## Completion optimizations — 2026-10-12 (unpublished)

Final development build `0.5.6+bd244406ae57` passes **95 unit/integration tests and 18 verification stages**. The complete run is `test-output/completion-regression-final-v4.log` with structured results in `test-output/release-verification.json`. No version bump or publishing was performed.

- Canonical partial diagnostics survive repeated validation. Invalid critical questions/controls fail explicitly rather than disappearing from a supposedly complete delivery. Source-fence repair only accepts deterministic grammar repairs, not fabricated completion of truncated JSON. Same-turn notices are deduplicated, cancellation/subagent aware, limited to two notices without stopping inference, and disabled by the optional autoRepair setting.
- All eight scene examples validate and render read-only in settings. Targeted retrieval injects only a short index in guided mode. Browser checks verify real asset fetching, matching builds, activation/feedback reporting, style-save conflict behavior and PC/light/dark layouts.
- update_ui covers ownership, atomic revision archives, canonical key-order-independent retries, conflicting operation IDs, stale revisions, unambiguous extended append, root/target replacement and newly introduced input defaults. Existing compatible state survives edits. Browser checks append a defaulted select, reorder a stable-ID plot, and restore parameter 2, panned viewport, selected tab, table sort and quiz state across remount/twin views and offline HTML export.
- Repeated known same-session markers show one interface without exposing UUID plumbing; foreign IDs remain plain code. Existing progressive-preview stability, script isolation, local computation, export and recovery suites remain passing.

Real-model acceptance used **MiniMax-M3.1-Flash-Preview High**, `J:\测试结果`, and natural completion with no reasoning/time cap or cancellation. The final test build for the model was `0.5.6+d5e32048c472`; the only subsequent production change hides repeated UUID markers, covered by the final regression and installed smoke test.

1. Function explanation/parameter plot: completed in 19.1s, validate_ui + render_ui, zero tool errors, one rendered visual, reload restores it.
2. Follow-up append: completed in 18.0s, inspect_ui + update_ui, zero tool errors, still one visual and amplitude **2** retained through refresh.
3. Deliberately malformed quiz source: one plugin correction notice in the same turn; model supplied missing options and naturally finished in 10.8s. The corrected quiz grades locally and retains the answer after refresh. This is an intentional failure probe, not an organic model-error rate.

Both Web and Desktop were replaced with the final build. Authenticated runtime checks confirm matching client/host build, local assets, feedback registration, native sidebar and read-only scene preview; evidence: `test-output/completion-live/installed-profiles.json`. All 176 package files are checked against each installed profile. The final package/audit report is retained under completion-pack.json and completion-audit.json.

Evidence: `test-output/completion-live/acceptance.json`, `interactions.json`, `updated-retained.png`, `repaired-graded.png`. Earlier development retries are retained as initial/second/third/fourth-retry.json. They exposed heading/container spellings, mixed vocabulary and update defects fixed in this batch. One harness assertion incorrectly expected a separate check button on an immediate-grading quiz; the follow-up interaction run used the actual option button and passed. These are a few observed cases, not a guarantee that every model will always generate correct UI in one attempt.


## Extended native visuals and source fences — 2026-10-12

Development build `0.5.6+9c515da98b29` passes **89 tests and 18 verification stages**. Browser fixtures execute numeric table sorting/filtering, quiz/input remount restoration, keyboard tabs and KaTeX, local radio-paper grading, one collected form request, ECharts (including word cloud), Mermaid and Three.js lazy loading, source-fence preview/commit/source replacement, and 1920/1365 PC bounds. Ordinary text does not load the visual core or engines. A two-view fixture verifies that untouched snapshots do not save and edited fields synchronize without initialization conflicts. Standalone HTML restores input state, grades quizzes and renders math without HTTP requests.

MiniMax-M3.1-Flash-Preview (High), exclusively in `J:\测试结果`, naturally completed these accepted cases: a three-question Git paper with one local submission (28.9s, ui_catalog + render_ui); a direct assistant source fence containing a table and donut chart (6.7s, no tools); and Mermaid + ECharts + adjustable function plot (10.0s, one render_ui). Each has a rendered visual and no tool/browser errors and survives reload. These are individual observations, not a model-wide reliability benchmark; no reasoning cap or cancellation was used. Evidence: `test-output/visual-live/initial-results.json` (first two cases) and `results.json` (accepted complex rerun).

Earlier attempts exposed real integration defects: omitted buffered GET mode produced HTTP 400 for local assets; typed quiz option wrappers were discarded during partial repair; omitted nodeIds failed explicit node inspection; untouched initial answer snapshots could trigger competing saves. These were corrected and covered by regression fixtures. The initial complex case retained its inspection error in evidence rather than being counted as a pass.

Real Web interaction acceptance also passes: three selected answers grade without starting a model turn and survive refresh; the model's function slider changes locally; ECharts/Mermaid render; the source fence restores exactly one UI without duplicate JSON. Evidence: `test-output/visual-live/acceptance.json` and `interactions.json`.

The npm dry-run package includes local runtime/engine/font assets and the MIT upstream attribution plus licenses of the bundled dependency graph (170 files, approximately 2.96 MB compressed). No test output, vendor source tree, node_modules, profile configuration or credentials are packed. Full dependency audit reports zero vulnerabilities. Web and Desktop installed-file checks match all 170 packaged files to this build. Desktop starts from `F:\DSH-Desktop\DeepSeek Harness.exe` using its own desktop profile and owns the localhost 19387 listener; the unrelated Tailscale listener is untouched. Version stays 0.5.6 and this batch is unpublished.

Scope: this embeds the upstream component core, not its host plugin. Motion UI retains native sidebar placement instead of `/panel` or composer-dock commands and does not expose custom renderer registration. External media still needs its source; standalone exports cannot invoke host Agent actions/files. Function-plot parameters remain component-local; native state/derived or canvas is the supported shared-calculation path.

## Progressive previews and native sidebar — 2026-10-12

Build `0.5.6+2f37d594aac7` passes 79 tests and 17 verification stages. Complete native blocks and inert canvas previews appear during generation. An independent conversation surface retains valid previews across tool-seat remounts and live-to-durable rebasing; explicit failures invalidate only their own calls. Generated scripts and interactive controls activate after the whole reply finishes. Production fixtures cover multiple calls, malformed later prefixes, iframe identity, navigation and cancellation cleanup.

MiniMax-M3.1-Flash-Preview (High) naturally completed a two-document task in `J:\测试结果` with render_text and render_canvas, then continued prose. First preview appeared at about 18.2 seconds and the reply completed at about 35.5 seconds. Across 1048 sampled preview frames there were zero gaps, no tool or browser errors, and both durable UIs restored after reload. No reasoning cap or cancellation was applied. This is one observed case, not a general model success-rate benchmark. Evidence: `test-output/progressive-live/results.json`.

Display-location controls and inline sidebar-opening buttons are removed. Markers position documents in the reply; the native right-sidebar “智能 UI” entry remains available. A real Web smoke check opened that entry, found two current-session documents, and confirmed zero inline sidebar buttons and browser errors. Evidence: `test-output/native-sidebar-verification.json`. Version remains 0.5.6; this development batch is unpublished.

## Default bright flat and five-style real-model acceptance — 2026-10-12

Build `0.5.6+b15c6ac6ff08` passes 75 tests and 16 verification stages. A shared default constant selects 明亮扁平 in Host configuration, model prompt resolution and settings fallback. Existing explicit style choices remain respected; free mode remains free of selected design examples.

MiniMax-M3.1-Flash-Preview (High) completed the same static comparison/three-step task in five fresh `J:\测试结果` sessions. Each completed naturally with one render_canvas call and no tool errors: 清爽阅读 17.9s, 柔和彩色 17.7s, 技术图解 20.7s, 活力展示 21.3s, 明亮扁平 24.3s. Each durable system message includes only its selected style heading; all UIs restore after reload and fit their PC canvas width, with no page errors. Screenshots and computed CSS show distinct style directions. Technical used Host blue rather than the suggested teal, so this does not certify exact palette compliance. These are individual fixed-task observations, not a general success-rate or unsolicited-UI-selection benchmark. Evidence: `test-output/style-matrix/results.json`, `visual-review.md` and the five style screenshots. Web ends on 明亮扁平.

## Style preview and autonomous layout refinement — 2026-10-12

75 tests and 16 verification stages pass for build `0.5.6+528535839d64`. The style is now displayed as 明亮扁平. Five layouts (text, comparison, separated list, data summary, flow) can be previewed for each of five visual directions. Browser checks verify that preview switching makes no settings writes, while clicking a style saves and survives reload. The heading explicitly says guided-only; free-mode prompts still omit all selected style guidance/examples. The default text-layout control was removed. Legacy `defaultPreset` values remain readable for configuration compatibility but are ignored by new tool calls and prompt injection; models retain per-document layout choice, with ordinary reading as the omitted-preset fallback. PC light/dark and narrow-width checks pass.

## Selectable visual styles development build — 2026-10-12

75 automated tests and 16 verification stages pass. Five settings previews share fixed comparison content and cover selection, persistence after reload, rejected writes, keyboard navigation, free-mode preference preservation, PC light/dark screenshots and narrow-width bounds. Every registered style has valid native and sandbox examples. Host checks verify that live style changes affect only design guidance/examples, preserve the protocol section and do not change registered tools; free-mode prompts remain identical for every stored style.

PrismFrame bright-flat guidance was derived from the local v0.2 Occamy examples and style guide. It adapts their five palettes, rounded white panels, colored offset shadows and explanatory graphics to compact chat surfaces. Video subtitles, page counters, full-screen whitespace and glass effects are excluded. Preview cards are fixed illustrative samples; they are not a guarantee of an arbitrary model's design quality. Version remains 0.5.6; no publication for this development batch.

Real Home → Plugins selection/save/reload passes. A fresh MiniMax-M3.1-Flash-Preview session in `J:\测试结果` completed naturally in 54.6 seconds with one render_canvas call and zero tool/browser errors. The durable model-visible system message contains the selected PrismFrame guidance. Its three-stage diagram uses a pale green background, white rounded cards, colored edges and offset shadows; refresh restores it. This is one observed case, not a general success-rate claim. Original Web style/mode preferences were restored. Evidence: `test-output/styles-live-settings.json`, `styles-m31-live.json`, `styles-m31-prismframe.png`, `styles-restored-prefs.json`.

## Everyday reading development build — 2026-10-11

73 automated tests and 15 verification stages pass. New coverage includes eight independent presets, typography and inline emphasis, exact numeric/array transport normalization, bounded authoring, URL validation, native file callbacks, per-document parameter isolation, multiple inline markers, refresh recovery, and 1920/1365 px light/dark layouts. Settings were saved and reloaded through Home → Plugins, then restored to their original value.

MiniMax-M3.1-Flash-Preview was tested on the real Web host in `J:\测试结果`, without a reasoning time cap or early cancellation. The final proactive prompt produced comparison + flow in 19.6 seconds; the mixed-content prompt produced four independent native surfaces in 17.0 seconds, including web and enabled file buttons. Both completed with zero tool errors and restored after refresh. These are two observed cases, not a general first-attempt success rate.

Earlier attempts exposed missing typography transport normalization and incomplete multi-part delivery. The fixes preserve numeric ranges, reject ambiguous fields, unwrap only exact item-array wrappers, and clarify that necessary multiple UI calls are not limited by the optional polishing guidance. Replaying all seven calls from the transport-failure session now passes unchanged. The version remains 0.5.6 as a local development build; no registry release was made for this update.

## 0.5.6 — authoring compatibility and stable presentation (2026-10-10)

68 automated tests and 14 release stages cover typed transport normalization, decoded-object safety, exact node/argument diagnostics, field-order independence, canvas metadata defaults, durable end-of-turn UI presentation, state recovery, isolation and standalone export. Clean npm ci reports zero vulnerabilities. Production UI preview is disabled; static preview utilities remain internally tested but are not registered tool entry points.

The end-of-turn browser regression uses the real turn extension plus production ToolView/TurnUiView: partial arguments, successful tool results, late prose markers and changing tail anchors do not mount UI/iframe before turn/end. After turn completion, a single UI appears and retains input and iframe identity. Interrupted/error endings also reveal successful results. Text/reasoning streaming and model stopping behavior are unchanged. Replaying the supplied real session events confirms readiness changes only on turn/end.

Original travel-call replay passes eight of ten previously failing calls unchanged; two still need actual missing bounds/formula operands. Another session's three alleged field-order failures each omit sandbox id; adding only that id fixes them without reordering. No general model first-attempt success rate is claimed. Desktop local fixes were package-file verified and user-tested before this release; this does not change the declared Web compatibility range.

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



### 可复制文本与代码（0.5.6 未发布开发版）
原生 text(copyable/title) 与 code(lang/title/wrap)，扩展 text/code 的字段校验和修复后保留均已验证。1920×1080 Edge 实测 Clipboard API 原文复制（Windows 原生换行规范化）、拒绝 API 后兼容复制、失败反馈、临时 textarea 清理、字面 HTML 不执行、长行内部滚动、明暗主题及只读预览禁用复制。证据：test-output/copy-verification.json、copy-light.png、copy-dark.png。

### 引导风格覆盖原生组件
五种风格逐一检查原生指标卡背景、控件配色、PC 明暗主题、横向溢出与切换自由模式后还原；共享状态和链接行为保留。证据：test-output/native-style-verification.json、native-style-prismframe-light.png。

### 动态交互与柔光渐彩（0.6.0 本地开发，未发布）
新增第六种可选风格，保留明亮扁平默认值；设置选择/持久化、五种布局比较和自由模式不注入新风格均验证。原生分段选择键盘方向键/Home/End、快速输入后的精确 derived/进度、超过八项回退下拉框、独立文档参数与刷新恢复、减少动态效果、预览禁用控件及 PC 明暗主题均由 tests/verify-motion.mjs 验证。证据：test-output/motion-verification.json、motion-aurora-light.png、motion-aurora-dark.png。

### 2026-10-13 本地参考案例校正
13 个用户提供的 HTML 按静止、悬停、操作中、结束状态审阅，结果在 test-output/reference-motion/review.json。新增原生主按钮渐变扩散/文字滚动/磁吸、数字步进、可拖拽弹性开关、指标滚动强调和真实状态动态画布案例；tests/verify-motion.mjs 覆盖拖拽与 Space 切换、实际链接打开、步进/精确数值/刷新恢复、画布持久化与减少动态效果。原始素材未改动，MIT 来源保留于 lib/third-party/lucian-uxui-*。


## 全局动效与完整风格回归

新增六种风格与自由模式的原生控件覆盖、不同动效配色、切换时输入焦点及数值保留、逐风格 reduced motion 验证。验证结果见 test-output/global-style-regression-final.log。


### 本地开发：计算器首次交付修复

针对会话 d696983a 的七次失败：明确缺失 document.nodes/version 和嵌套 children 的路径，图表错误给出行号、缺失字段及已有列；新增安全原生 ceil/floor；chart/table 支持内联 ref/expr 公式单元格，避免短构成图使用复杂 map。更新工具 Schema、Skill 与协议参考，静态 data 仍为字面数据，不猜测或补造金额。默认 4620 元、1..12 人奇偶房间数、动态图表和刷新恢复加入回归。不增加版本号、不发布。

进一步实测修正：重复表达式按不同结构计入静态复杂度，运行步数/深度限制保留；已声明且唯一的字符串列键支持等宽二维表格，按列顺序无损转换。真实模型第一份失败文档加入回归，可一次通过并保留项目名、规则和动态金额。


### 本地开发：视觉风格系统重构

六种稳定风格 ID 和明亮扁平默认值保留。新增构图、文字层级、表面、控件、反例的统一风格语法；原生文字/卡片/指标/表单/流程/表格/复制块与扩展卡片/指标有独立形态。所有风格保留共享交互动效，反馈幅度/节奏适配语言，减少动态效果仍优先。设置提供六种布局预览（含控件表单），直接复用生产组件 CSS，预览不包含可操作控件。相同内容的深浅主题、黑白对照、显式文字样式优先、输入焦点及数值保留加入回归。自由模式不注入这些风格。当前保持 0.6.0，本轮不发布。

模型实测补充：六种风格均实际交付；部分调用发生格式错误后由模型修正，记录不计为一次成功。进一步提示模型沿用风格默认字号/颜色，并在首个 heading 与文档标题完全相同时仅显示一个标题，保留显式文字样式和源文档。
