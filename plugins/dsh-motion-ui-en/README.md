# dsh-motion-ui-en

An English-localized derivative of [dsh-motion-ui](https://github.com/Scorp1o117/dsh-motion-ui) for **DeepSeek Harness (DSH)** Web and Desktop.

> **Derivative notice.** This project is not affiliated with, endorsed by, or maintained by the original author. It is a modified copy of `dsh-motion-ui` 0.8.7, redistributed under the MIT license with the original copyright notice retained. See [Licenses and attribution](#licenses-and-attribution).

## What it does

The plugin gives the model tools to answer with real interface instead of prose:

- **Native UI** — headings, cards, metrics, tables, charts, sliders, inputs, steps, quizzes, collapsible sections.
- **Freeform canvas** — model-authored HTML/SVG/CSS/JS running in an opaque-origin iframe, with declared state, data and derived formulas.
- **Motion** — a seekable timeline API (`DSHUI.timeline`) with storyboard keyframes.
- **Video** — export one saved canvas to MP4 locally through Chrome/Edge and FFmpeg, with captions, audio tracks and optional narration.
- **Mechanisms** — adjustable assembly, gear and crank diagrams.

## Why this derivative

The upstream plugin is Chinese-first: its interface chrome, settings page and much of its guidance are written in Chinese. This derivative translates the **user-facing interface** into English while keeping behavior identical.

It is a localization, not a redesign. If you want a different feature set, fork this or upstream — the code is the same shape.

## Install

This plugin lives inside the [dsh-plugins](https://github.com/KardDev/dsh-plugins) collection, so install it from a checkout (package managers resolve Git dependencies at the repository root, not at a subdirectory):

```sh
git clone https://github.com/KardDev/dsh-plugins.git
cd dsh-plugins && pnpm install
dsh plugin add ./plugins/dsh-motion-ui-en
```

Restart the DSH host, then reload the browser page. Settings live under **Home → Plugins → dsh-motion-ui-en**.

> **Do not install this alongside the upstream `dsh-motion-ui`.** Both register the same tool names (`render_ui`, `render_canvas`, …), so loading both will conflict.

## Requirements

| Requirement | Notes |
|---|---|
| Node.js | `>= 22.19` |
| DSH | Development target: `0.2.1-rc.5`; also supports `0.2.0-rc.2`, `0.2.1-rc.1`, `0.2.1-rc.2` and `0.2.1-rc.3` |
| Chrome, Edge or Chromium | Only for video export and canvas rendering at export time |
| FFmpeg + FFprobe | Only for video export and processing; never downloaded automatically |
| MiniMax credentials | Only for `synthesize_voice`, which calls a paid API |

See [rc.5 compatibility checks](docs/compatibility-0.2.1-rc.5.md) for the migration validation and limits.

Override binary locations with `DSH_MOTION_BROWSER`, `DSH_MOTION_FFMPEG` and `DSH_MOTION_FFPROBE`.

## Tools

| Tool | Purpose |
|---|---|
| `render_text` | Typography-first blocks: text, comparison, list, steps, code, links |
| `render_ui` | Validated native components with local state and formulas |
| `render_canvas` | Freeform HTML/SVG/CSS/JS in an isolated canvas |
| `render_scene` | Short flow / comparison / allocation / budget scenes |
| `render_mechanism` | Assembly, gear and crank diagrams |
| `ui_catalog` | On-demand reference material and examples |
| `validate_ui` | Check a document without displaying it |
| `inspect_ui`, `patch_ui`, `update_ui` | Read, edit in place, and extend a saved document |
| `preview_video` | Capture exact source-timeline frames before encoding |
| `render_video` | Export one canvas to MP4 plus editable source |
| `inspect_video`, `process_video` | Sample, trim, join and caption local video |
| `synthesize_voice` | Narration with provider-measured timing (paid API) |

## Localization status

Be precise about what this derivative changes:

| Surface | Language |
|---|---|
| Interface chrome — settings, sidebar, buttons, status and error messages | **English** |
| Tool names, descriptions and JSON schemas | English (unchanged from upstream) |
| `motion-design` skill — the motion-graphics craft guidance | English (unchanged) |
| Example catalogs and demo content (`lib/`) | Chinese (unchanged) |
| Guided-mode design curriculum injected into the prompt | Chinese (unchanged) |

If you want no Chinese in the model's context, set **Design mode → Free design** in the plugin settings. Free mode injects only the canvas interface contract, which is English. Generated interfaces follow your prompt language either way.

## Design modes

- **Guided** — injects a design skill, component protocol and worked examples. Shapes how the model composes UI.
- **Free design** — injects only the canvas interface and interaction constraints; the model composes layout and styling itself.

Both modes carry identical runtime permissions. The setting takes effect from your next request; existing conversations may keep older guidance.

## Development

```sh
pnpm install      # dev dependencies, including esbuild
npm test          # unit and integration tests
npm run build     # regenerate client.js, lib/build-info.js and bundled assets
```

`npm run build` bundles `src/client.jsx` into `client.js` with esbuild. It also regenerates vendored assets (`lib/assets/*`) — if your dependency versions differ from upstream's, those files will churn even when you changed nothing. Upstream does not commit a lockfile, so builds are not byte-reproducible across machines.

If the host sandbox blocks the build with `spawn EPERM`, that is Node's `child_process` being unable to open the pipe esbuild needs. Run the build with the sandbox set to full access, or invoke the esbuild binary directly.

## Upstream updates

This plugin lives in a subdirectory of the [dsh-plugins](https://github.com/KardDev/dsh-plugins) collection, and the upstream history was imported as a subtree. Pull upstream releases from the **repository root**:

```sh
cd dsh-plugins
git remote add upstream https://github.com/Scorp1o117/dsh-motion-ui.git   # once
git fetch upstream --tags
git subtree pull --prefix=plugins/dsh-motion-ui-en upstream main
```

If `git subtree` is unavailable or crashes on your platform, the equivalent manual import is:

```sh
git fetch upstream main
git merge --allow-unrelated-histories -s ours --no-commit upstream/main
git read-tree --prefix=plugins/dsh-motion-ui-en/ -u upstream/main
git commit -m "Update dsh-motion-ui-en from upstream"
```

Either way, then rebuild and re-test:

```sh
pnpm --filter dsh-motion-ui-en build
pnpm --filter dsh-motion-ui-en test
```

Expect conflicts in `src/settings.js`, `src/view.js` and the other localized files. That is the ongoing cost of this derivative — keep translation edits confined to string literals so merges stay tractable.

## Licenses and attribution

- **This repository** — MIT. Original copyright notice retained; see `LICENSE`.
- **`skills/motion-design/`** — Copyright 2026 Open Design contributors, Apache-2.0. `SKILL.md` and `SOURCES.md` are unmodified upstream files; `LICENSE` and `NOTICE.md` must travel with any redistribution (Apache-2.0 §4(d)).
- **`vendor/dsh-genui/`** — MIT, with its own `LICENSE` and `NOTICE.md` from `omdsh-dev/dsh-genui`.
- **`lib/third-party/`** — vendored components with per-file license notices.

Upstream project and author: [Scorp1o117/dsh-motion-ui](https://github.com/Scorp1o117/dsh-motion-ui).

The original Chinese README is preserved as [`README.zh-CN.md`](README.zh-CN.md).
