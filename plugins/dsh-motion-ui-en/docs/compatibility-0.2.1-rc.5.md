# DSH 0.2.1-rc.5 compatibility

The current development target is DSH **0.2.1-rc.5** / Node >=22.19. Existing declarations for rc.3, rc.2, rc.1 and 0.2.0-rc.2 are retained. The official release is https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.5.

## Changes

- Added rc.5 to the package's DSH engine, compatibility and SDK peer ranges; pinned development SDKs to rc.5.
- Added a real rc.5 tool-registry test covering all 17 registrations, durable render_ui presentation metadata, malformed-input rejection and tool/route disposal. The authenticated HTTP carrier is a fixture in that test.
- Corrected four pre-existing assertions in the English derivative: two review tools had raised the count from 15 to 17, and three interface labels had been translated to English.
- Rebuilt the browser client and source build identity while preserving vendored visual-engine assets. No host runtime behavior or settings contract changed.

## Executed checks

- All 150 unit/integration tests passed against the verified rc.5 dependency cohort; the rc.3 intermediate suite also passed.
- Every direct DSH development SDK resolves to rc.5. Browser module factory exports and source build hash passed validation.
- Static steps and compact error browser checks passed at 1920px and 1365px in light/dark themes with no page errors.
- The bundled desktop rc.5 installer accepts this package without an exact-version exemption.

Complete Electron UI/video playback was not exercised. The separate Auto Review Luna plugin remains pinned to rc.2 and is still rejected by the desktop's rc.5 startup gate. Historical release/media verification remains recorded in VERIFICATION.md.
