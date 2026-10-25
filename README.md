# DSH plugins

A collection of plugins for **DeepSeek Harness (DSH)**. Each plugin lives in its own directory under `plugins/` and is versioned independently.

| Plugin | Description | Status |
|---|---|---|
| [`dsh-motion-ui-en`](plugins/dsh-motion-ui-en) | English-localized interface, HTML/SVG canvases, editable motion and local MP4 production. Derivative of [dsh-motion-ui](https://github.com/Scorp1o117/dsh-motion-ui). | Active |
| [`dsh-cost-usage`](plugins/dsh-cost-usage) | Per-session API cost tracking, provider/model breakdowns and optional pricing auto-discovery. | Active |

## Installing a plugin

DSH installs plugins by package spec. Since each plugin lives in a subdirectory here, and package managers resolve Git dependencies at the repository root, install from a checkout:

```sh
git clone https://github.com/KardDev/dsh-plugins.git
cd dsh-plugins
pnpm install
dsh plugin add ./plugins/dsh-motion-ui-en
# Or install cost tracking into a named profile:
dsh plugin --profile <name> add ./plugins/dsh-cost-usage
```

Restart the DSH host and reload the page afterwards.

Once a plugin is published to npm, the short form works too:

```sh
dsh plugin add @karddev/dsh-motion-ui-en
```

## Repository layout

```
plugins/
  dsh-motion-ui-en/     # conversational UI, canvases and motion
  dsh-cost-usage/       # cost tracking and pricing discovery
pnpm-workspace.yaml     # workspace definition (packages: plugins/*)
```

Plugins are pnpm workspace packages with dependencies hoisted to the repository root (`nodeLinker: hoisted`). The hoisted layout matters on Windows: the plugin build runs esbuild through Node's `child_process`, and a symlinked per-package `node_modules` does not resolve reliably there.

## Working on a plugin

```sh
pnpm install                        # every plugin's dependencies
pnpm --filter dsh-motion-ui-en test
pnpm --filter dsh-cost-usage check
```

Each plugin keeps its own README, tests, license and third-party notices. See the plugin directory for details.
