# dsh-cost-usage

**Provider-agnostic cost tracking plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).**

Track LLM API spending per session by configuring per-model token pricing you declare in your profile configuration. Works with any provider — OpenAI-compatible APIs, AWS Bedrock, Alibaba Cloud, and more.

## Features

- **Per-session cost tracking** — accumulates costs across the entire session via a `costUsage` session projection
- **Provider-agnostic** — works with any provider route; just configure pricing per model
- **Manual pricing configuration** — declare per-token rates in `cordis.patch.yml`
- **Auto-discovery** — opt in to adopt per-model rates a provider publishes on its `/models` endpoint
- **Wildcard defaults** — set a `"*"` model key to provide fallback pricing for all models in a provider
- **Session cost UI** — the client half registers a cost pill beside the context meter with a clickable breakdown dialog
- **Per-route breakdown** — see cost split by provider/model
- **Per-component breakdown** — see input, output, and cache costs separately
- **Zero for unpriced routes** — a route with neither a manual entry nor a published rate reports zero cost rather than a guess

## Installation

Requires DSH 0.2.x: the peer range is `>=0.2.0-rc.2 <0.3.0`, verified against
0.2.0-rc.2 and 0.2.1-rc.2. Older or newer DSH majors are refused by the
plugin manager rather than activated.

### 1. Install the package

This plugin is maintained in the [dsh-plugins](https://github.com/KardDev/dsh-plugins)
collection. The former standalone `cost_display` repository is archived.

Install from a checkout:

```sh
git clone https://github.com/KardDev/dsh-plugins.git
cd dsh-plugins
pnpm install
dsh plugin --profile <name> add ./plugins/dsh-cost-usage
```

Replace `<name>` with your DSH profile name. If the collection is already cloned,
use its existing checkout. Git dependencies resolve at the repository root, so
adding `github:KardDev/dsh-plugins` as a dependency will not select this plugin.

The plugin manager links the directory, so source edits stay live. A `file:`
dependency is copied at install time and can go stale when you edit the source.

### 2. Configure pricing

Add pricing configuration to your `cordis.patch.yml`:

```yaml
- id: dsh-cost-usage
  name: dsh-cost-usage
  config:
    # Currency symbol for display (default: $)
    currency: "$"

    # Per-model pricing configuration
    # Keyed by provider route, then model id
    pricing:
      my-openai-provider:
        # Per-model pricing
        gpt-4o:
          input: 0.0000025
          output: 0.00001
        gpt-4o-mini:
          input: 0.00000015
          output: 0.0000006

      my-aws-bedrock:
        # Wildcard "*" provides defaults for all models in this provider
        "*":
          input: 0.000003
          output: 0.000015
        # Specific model overrides the wildcard
        claude-sonnet-4-20250514:
          input: 0.000003
          output: 0.000015
```

### 3. Restart DSH

The plugin activates on next startup. The `costUsage` projection will begin accumulating costs from that point forward.

### Auto-discover published pricing

If a provider publishes per-model rates on `GET {baseURL}/models`, the plugin can adopt them instead of you copying numbers by hand. Discovery reads each route's endpoint and credential reference from the profile composition (`llm-pi-ai` providers and `llm-deepseek`) and resolves the key through the credential store — no endpoint or key is duplicated in this plugin's config.

```yaml
- id: dsh-cost-usage
  config:
    autoDiscover: true        # equivalent to {} with defaults
    # or, for overrides:
    # autoDiscover:
    #   refreshMinutes: 360
    #   includeConfigured: true
    #   providers:
    #     engy:
    #       baseURL: https://api.engy.ai/v1
    #       apiKeyEnv: ENGY_API_KEY
    #       units: perToken   # or perMillion; default auto-detects
```

Behavior:

- Runs about 3 seconds after the plugin activates, then every `refreshMinutes` (default 360).
- Reads `prompt`/`completion` (also `input`/`output`) plus common cache spellings; numeric strings are accepted.
- Auto-detects per-token versus per-million prices (values above `0.001` are treated as per-million) unless `units` is set.
- Explicit `pricing` entries always win. A discovered rate beats a `"*"` wildcard fallback.
- Routes that publish no pricing (for example Ollama) and unreachable routes are skipped silently; the last outcome per provider is available as `ctx.costUsage.discoveryReport`.
- Discovery is best effort: no retries, no secrets in logs, and a failure never affects cost folding.


## Usage

Once installed and configured:

1. **Cost pill** - registers into the `conversation.composer.dock` slot, so it appears in the composer row beside the context meter, showing the current session total cost
2. **Click for details** — click the cost pill to open a breakdown dialog showing:
   - Cost per provider/model route
   - Cost by component (input, output, cache read, cache write)
   - Session total

   The panel closes on Escape, an outside click, or a window resize.

## Configuration Reference

### Plugin Configuration (`cordis.patch.yml`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `currency` | string | `"$"` | Currency symbol for display |
| `pricing` | object | `{}` | Per-model pricing rates, keyed by provider route → model id |
| `autoDiscover` | boolean \| object | `false` | Adopt rates published on each configured route's `/models`; `true` or `{}` enables defaults, an object accepts `refreshMinutes`, `includeConfigured`, and a `providers` override map |

### Pricing Entry

Each pricing entry supports:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `input` | number | `0` | Cost per input token |
| `output` | number | `0` | Cost per output token |
| `cacheRead` | number | `0` | Cost per cache-read token |
| `cacheWrite` | number | `0` | Cost per cache-write token |

A `"*"` model key sets default pricing for all models under that provider. Specific model entries override the wildcard.

## How It Works

The plugin consists of two parts:

### Server-side (`lib/index.js`)

A Cordis plugin that:

1. Registers a `costUsage` session projection on `ctx.sessionProjections`
2. Listens to `assistant/message` events in the session log
3. Reads the provider, model, and token usage from each event
4. Looks up explicit pricing, then a discovered rate, then the provider wildcard
5. Accumulates costs session-wide, per-route, and per-turn
6. Exposes the accumulated data through the standard projection seam

When `autoDiscover` is enabled it additionally reads each route's effective
`baseURL`/`apiKeyEnv` through `configEditor`, resolves the key through
`credentials`, and adopts any rates the provider publishes on `/models`.
Because discovery is asynchronous, a turn recorded before the first fetch
settles stays at zero cost; later turns use the adopted rates.

### Client-side (`lib/client.js`)

A ModuleLoader browser bundle that:

1. Connects to the session controller's projection value store
2. Subscribes to `costUsage` projection updates
3. Renders the cost pill as a `conversation.composer.dock` slot entry beside the context meter
4. Provides a clickable breakdown dialog

## Plugin API

Other plugins can access cost data through the Cordis context:

```typescript
// On the server side
const costUsage = ctx.get('costUsage');
// costUsage.pricing — the PricingRegistry instance
// costUsage.projectionKey — 'costUsage'
// costUsage.discoveryReport — last auto-discovery outcome per provider

// Read current projection state via the session projection system.
// stateOf returns the raw folded state (or undefined when the key is not registered);
// snapshot(session, [keys]) returns { asOfSeq, values } with schema-validated views.
const state = ctx.sessionProjections.stateOf(session, 'costUsage');
const { values } = ctx.sessionProjections.snapshot(session, ['costUsage']);
// values.costUsage.totalCost, values.costUsage.totalInputCost, etc.
```

## License

MIT

## Contributing

Contributions welcome! This plugin aims to be provider-agnostic and community-driven.