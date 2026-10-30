# Verification

## 0.1.1 - live DSH dark-theme repair

A real rc.5 desktop conversation called decision_lab successfully and persisted valid metadata, but its card was hidden in nested work details and rendered with a white fallback surface under the host's pale dark-theme text. Version 0.1.1 uses DSH's actual bg-layer-1 token and a readable ink fallback when no brand token exists. The standalone demo now uses the same surface token. A browser regression reproduces the previously white surface with native-only theme tokens and checks readable text/control contrast. The usage guide now explains where to open the card.

Native rc.5 desktop verification: the existing completed card hot-reloaded with readable colors; increasing Delivery Speed changed the leader to Quick Prototype (6.89), and Reset restored the original priorities and Full Implementation leader (6.69). No new model call was required. The card was left open at its sliders.

## Collection target update - DSH 0.2.1-rc.5

The collection now develops against rc.5 while retaining the previously tested rc.2/rc.3 declarations. All 95 tests and Chromium interactions/exports/replay pass on rc.5. Every direct SDK dependency resolves to rc.5, the client bundle still matches its source, and the desktop compatibility gate accepts Decision Lab. Motion UI's earlier mismatch has been corrected in the collection; the separate Auto Review Luna checkout still has an rc.2 declaration. The local rc.3 review below is historical. Full Electron integration remains unverified.

## Local Windows review - 2026-10-30

- Node 22.19.0 / React 18.3.1: all 95 tests passed against the pinned DSH `0.2.1-rc.2` dependencies, then all 95 passed again against `0.2.1-rc.3`.
- Fixed `tests/client.test.mjs` to convert its file URL using `fileURLToPath`; passing URL.pathname to esbuild fails on Windows drive-letter paths.
- Declared DSH support for the two tested versions (`rc.2 || rc.3`) and moved development dependencies to `rc.3`. The installed desktop is `0.2.1-rc.3`; its installer refused the original rc.2-only declaration. No compatibility exemption was granted.
- Source build and runtime syntax checks passed. Rebuilt `client.js` is byte-identical to the supplied archive.
- Chromium interaction/export/replay checks passed on both DSH targets. Desktop, 375px mobile and dark screenshots were inspected; mobile has no horizontal overflow.
- Installed into the owner's local desktop profile through the bundled DSH CLI. Confirmed the profile dependency, bundle entry and package link. A smoke test resolving the package through that profile registered and executed `decision_lab` with the packaged example, checked replay metadata, then verified disposal unregisters the tool.
- Existing Distill files and the Git index were unchanged. The workspace lockfile differs from its pre-review state only by the new Decision Lab importer.

The complete Electron application was not launched. Its installer reports pre-existing `rc.3` compatibility conflicts in Auto Review Luna and Motion UI and says startup will deny those plugins. These unrelated plugins were not changed. Browser checks use the documented demo slot adapter; they are not a full Electron UI test. Existing peer warnings remain visible. No paid model calls were made.

## Original archive verification

The remaining sections describe verification reported in the supplied archive before this local Windows review.

### Executed checks

Development target: `@deepseek-ai/dsh-tools@0.2.1-rc.2`; React 18.3.1.

- Node 26.7.0: 95 tests passed, zero failures or skips.
- Node 22.19.0 (declared minimum): 95 tests passed, zero failures or skips.
- `npm run build` and `npm run check`: passed.
- `npm pack` archive installed in a fresh scratch directory with the actual DSH peer packages; its installed entry point successfully registered and executed `decision_lab` on the included example. The first probe omitted DSH's transitive peers with `--legacy-peer-deps` and failed on missing `dsh-scope`; installing the declared peers normally resolved that test-environment error without source changes.
- Real Cordis / DSH tool registry: registration, canonical result, persisted-presentation metadata, malformed-input refusal, pre-aborted calls and unload/disposal passed.
- Chromium: packaged browser module mounted through a demo slot adapter. Sliders changed the leader; an all-zero state was refused; reset and keyboard interaction passed; JSON/Markdown downloads contained the current scenario; reloading restored the original result; malformed metadata, pending and error states rendered safely; no page errors.
- 375px layout: no horizontal overflow. Desktop, mobile and dark screenshots captured. The primary controls have 44px minimum interactive heights. This is not a comprehensive accessibility audit.
- Strict engine tests cover bounds, prototype-related identifiers, Unicode byte limits, unknown fields, malformed JSON, accessor rejection, tie handling, point dominance, sensitivity grid endpoints and exported provenance.
- Runtime security scan: no runtime network/file/command access, dynamic code execution, HTML injection or browser storage calls. Build/demo/test scripts use filesystem and process APIs as documented.

### Known limits

This verification is against the real DSH tool registry plus the actual browser bundle, **not** a complete installed DSH web/desktop application. No production DSH profile was modified. Other DSH versions, React 19, and non-Chromium browsers have not been exercised. No paid model call is required or included.

The initial SSR adapter used a separate VM realm, causing strict prototype validation to reject otherwise valid inputs. The adapter was corrected to the browser's single-realm JSON setup; production validation was not weakened. Browser exports were tested first as a missing feature, then implemented and rerun successfully.

### Existing repository baseline

Before changing existing plugin source, the motion UI suite produced **145 passed / 4 failed** out of 149 tests:

- `prompt-guidance.test.mjs`: expected 15 registered tools, observed 17.
- `stream-scenes.test.mjs`: expected a Chinese preview string; current source contains the English localization.
- `view.test.mjs`: expected a Chinese current-step label; current source contains the English localization.
- `view.test.mjs`: expected a Chinese chart-data label; current source contains the English localization.

No source in `dsh-motion-ui-en` or `dsh-cost-usage` was edited. Cost-plugin syntax checks pass. Those baseline failures are not counted as passing tests for this plugin.

The workspace lockfile previously listed only the motion package. Regenerating it includes the existing cost package and the new Decision Lab package. Existing package resolution records and the motion importer's direct dependencies remain unchanged. Existing DSH release-candidate peer-version mismatches and echarts-wordcloud's ECharts peer warning remain visible during installation; they are not silently waived as whole-repository compatibility.

## Reproduce

Run the commands in README.md from a checkout. `npm test` counts nested engine validation cases in its Node test total; do not add the engine's subtests again. `npm run test:browser` regenerates the actual bundle/demo, runs Chromium assertions, and saves screenshots under ignored `artifacts/`.
