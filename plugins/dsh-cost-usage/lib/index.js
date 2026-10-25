/**
 * dsh-cost-usage — host half.
 *
 * Server-side Cordis plugin that registers a `costUsage` session projection.
 * The projection listens to `assistant/message` events, reads token usage
 * and model identity, and folds in configured per-token pricing to
 * accumulate session-level cost tracking.
 *
 * Configuration is provider-agnostic: any model under any provider route can
 * have a `pricing` entry in the plugin config. Manual entries win, and an
 * unpriced route still reports zero cost. When `autoDiscover` is enabled, the
 * plugin reads each configured route's endpoint and credential reference,
 * queries its `/models` endpoint, and adopts per-model rates that the provider
 * publishes there; routes that publish none stay manual.
 *
 * @module dsh-cost-usage
 */


// ---------------------------------------------------------------------------
// Structural validation
// ---------------------------------------------------------------------------
//
// The projection seam only ever calls `.parse(value)` on `stateSchema` and
// `wire.viewSchema`, so a three-line validator is enough — and worth more than
// a real schema library here. This package is loaded from a linked directory
// that has no `node_modules`, so ANY bare import (zod included) fails to
// resolve and takes the whole plugin row down with it before `apply` runs.

/** Validation failure raised by the local schemas below. */
class SchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SchemaError';
  }
}

/** Wrap a plain predicate as something exposing the `.parse` the seam calls. */
function schemaOf(check) {
  return { parse: check };
}

/** A required finite, non-negative number. */
const costNumber = schemaOf((value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new SchemaError(`expected a finite non-negative number, received ${JSON.stringify(value)}`);
  }
  return value;
});

/** A required string. */
const textValue = schemaOf((value) => {
  if (typeof value !== 'string') throw new SchemaError(`expected a string, received ${JSON.stringify(value)}`);
  return value;
});

/**
 * A required object with every listed key present. Unknown keys pass through
 * untouched: a state restored from an older checkpoint must still load.
 */
function objectOf(shape) {
  return schemaOf((value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new SchemaError(`expected an object, received ${JSON.stringify(value)}`);
    }
    const parsed = {};
    for (const key of Object.keys(shape)) {
      if (!Object.hasOwn(value, key)) throw new SchemaError(`missing required key ${JSON.stringify(key)}`);
      parsed[key] = shape[key].parse(value[key]);
    }
    return parsed;
  });
}

/** A record whose every own value parses under `valueSchema`. */
function recordOf(valueSchema) {
  return schemaOf((value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new SchemaError(`expected a record, received ${JSON.stringify(value)}`);
    }
    const parsed = {};
    for (const key of Object.keys(value)) parsed[key] = valueSchema.parse(value[key]);
    return parsed;
  });
}

// ---------------------------------------------------------------------------
// Cost state schema
// ---------------------------------------------------------------------------

/**
 * Cost contribution from one model, keyed by "provider/model".
 */
const routeContributionSchema = objectOf({
  provider: textValue,
  model: textValue,
  inputCost: costNumber,
  outputCost: costNumber,
  cacheReadCost: costNumber,
  cacheWriteCost: costNumber,
  totalCost: costNumber,
});

/**
 * Full cost-usage state: accumulators per turn and session-wide totals,
 * plus per-route breakdowns.
 */
const costUsageStateSchema = objectOf({
  // Session-wide totals
  totalInputCost: costNumber,
  totalOutputCost: costNumber,
  totalCacheReadCost: costNumber,
  totalCacheWriteCost: costNumber,
  totalCost: costNumber,
  // Per-route accumulators
  routes: recordOf(routeContributionSchema),
});

/**
 * View exposed to the client via the projection seam — a subset of the
 * full state suitable for display.
 */
const costUsageViewSchema = objectOf({
  totalCost: costNumber,
  totalInputCost: costNumber,
  totalOutputCost: costNumber,
  totalCacheReadCost: costNumber,
  totalCacheWriteCost: costNumber,
  /** Display symbol from the plugin config, so the client needs no own copy. */
  currency: textValue,
  routes: recordOf(objectOf({
    provider: textValue,
    model: textValue,
    totalCost: costNumber,
  })),
});

// ---------------------------------------------------------------------------
// Pricing resolution
// ---------------------------------------------------------------------------

/**
 * Pricing rates for one model, per-token in the configured currency.
 */
class ModelPricing {
  constructor(input, output, cacheRead, cacheWrite) {
    this.input = input;
    this.output = output;
    this.cacheRead = cacheRead;
    this.cacheWrite = cacheWrite;
  }

  /**
   * Calculate cost from token usage.
   */
  costFor(usage) {
    if (!usage || typeof usage !== 'object') return null;
    const input = safeToken(usage.inputTokens);
    const output = safeToken(usage.outputTokens);
    const cacheRead = safeToken(usage.cacheReadTokens);
    const cacheWrite = safeToken(usage.cacheWriteTokens);
    if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) return null;
    return {
      inputCost: input * this.input,
      outputCost: output * this.output,
      cacheReadCost: cacheRead * this.cacheRead,
      cacheWriteCost: cacheWrite * this.cacheWrite,
    };
  }
}

function safeToken(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

// ---------------------------------------------------------------------------
// Pricing registry
// ---------------------------------------------------------------------------

/**
 * Holds pricing configuration for all providers/models, with wildcard support.
 *
 * The pricing data is stored as a flat map keyed by "provider/model" strings.
 * A "*" wildcard model provides defaults for any model within that provider.
 */
class PricingRegistry {
  constructor() {
    /** Map<"provider/model", ModelPricing> — explicit configuration */
    this._pricing = new Map();
    /** Map<provider, ModelPricing> — wildcard defaults */
    this._wildcards = new Map();
    /** Map<"provider/model", ModelPricing> — rates published by provider /models */
    this._discovered = new Map();
    /** Providers whose rates came from an endpoint, not configuration */
    this._discoveredProviders = new Set();
    /** Last discovery outcome per provider, for diagnostics. */
    this.discoveryReport = {};
    /** Currency symbol */
    this.currency = '$';
  }

  /**
   * Configure pricing from the plugin config object.
   */
  configure(configPricing, currency) {
    this.currency = currency || '$';
    this._pricing.clear();
    this._wildcards.clear();

    if (!configPricing || typeof configPricing !== 'object') return;

    for (const [provider, models] of Object.entries(configPricing)) {
      if (!models || typeof models !== 'object') continue;
      for (const [modelId, rates] of Object.entries(models)) {
        if (!rates || typeof rates !== 'object') continue;
        const pricing = new ModelPricing(
          safeRate(rates.input),
          safeRate(rates.output),
          safeRate(rates.cacheRead),
          safeRate(rates.cacheWrite),
        );
        if (modelId === '*') {
          this._wildcards.set(provider, pricing);
        } else {
          this._pricing.set(`${provider}/${modelId}`, pricing);
        }
      }
    }
  }

  /**
   * Get pricing for a specific provider/model combination.
   * Explicit configuration wins, then a discovered rate, then the provider's
   * wildcard fallback: a published rate is better evidence than a guess.
   */
  get(provider, model) {
    const key = `${provider}/${model}`;
    const exact = this._pricing.get(key);
    if (exact) return exact;
    const discovered = this._discovered.get(key);
    if (discovered) return discovered;
    const wildcard = this._wildcards.get(provider);
    if (wildcard) return wildcard;
    return null;
  }

  /**
   * Adopt one rate read from a provider's /models endpoint.
   * Explicit configuration still shadows it in `get`.
   */
  discover(provider, model, rates) {
    this._discovered.set(
      `${provider}/${model}`,
      new ModelPricing(
        safeRate(rates.input),
        safeRate(rates.output),
        safeRate(rates.cacheRead),
        safeRate(rates.cacheWrite),
      ),
    );
    this._discoveredProviders.add(provider);
    return this._discovered.size;
  }

  /**
   * Mark a provider as having been auto-discovered.
   */
  markDiscovered(provider) {
    this._discoveredProviders.add(provider);
  }

  /**
   * Whether a provider's pricing has been auto-discovered.
   */
  isDiscovered(provider) {
    return this._discoveredProviders.has(provider);
  }
}

function safeRate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

// ---------------------------------------------------------------------------
// Pricing discovery from provider /models endpoints
// ---------------------------------------------------------------------------
//
// Endpoints and credential references live in the profile composition, not in
// this plugin: `configEditor` exposes each route's effective `baseURL` and
// `apiKeyEnv`, and `credentials` resolves the key per request. Only providers
// that actually publish a price are adopted; everything else stays manual.

/** A price above this is per-million tokens, not per-token. */
const PER_MILLION_THRESHOLD = 1e-3;

/** Coerce one published price cell to a finite non-negative number. */
function parsePricingField(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

/** Guess whether published prices are per token or per million tokens. */
function autoPriceScale(input, output) {
  return Math.max(input ?? 0, output ?? 0) > PER_MILLION_THRESHOLD ? 1e-6 : 1;
}

/**
 * Normalize one provider pricing object to per-token rates.
 *
 * Accepts the shapes seen in the wild: `prompt`/`completion` (Engy,
 * OpenRouter), `input`/`output`, numbers or numeric strings, and the common
 * cache spellings. Unknown shapes return `null` and are ignored.
 */
function normalizeDiscoveredPricing(raw, units = 'auto') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = parsePricingField(raw.prompt ?? raw.input ?? raw.prompt_price ?? raw.input_price);
  const output = parsePricingField(raw.completion ?? raw.output ?? raw.completion_price ?? raw.output_price);
  if (input === null && output === null) return null;
  const cacheRead = parsePricingField(
    raw.input_cache_read ?? raw.cache_read ?? raw.cached_input ?? raw.cacheRead ?? raw.input_cache_hit,
  );
  const cacheWrite = parsePricingField(raw.input_cache_write ?? raw.cache_write ?? raw.cacheWrite);
  const scale = units === 'perMillion' ? 1e-6 : units === 'perToken' ? 1 : autoPriceScale(input, output);
  return {
    input: (input ?? 0) * scale,
    output: (output ?? 0) * scale,
    cacheRead: (cacheRead ?? 0) * scale,
    cacheWrite: (cacheWrite ?? 0) * scale,
  };
}

/**
 * Read effective route endpoints from the profile composition.
 *
 * `llm-pi-ai` carries a provider dictionary with `baseURL`/`apiKeyEnv` per
 * route; `llm-deepseek` is the single official route. Catalog routes without
 * an explicit endpoint are skipped because there is nothing to query.
 */
function composedRouteProfiles(ctx) {
  const routes = {};
  let editor;
  try {
    editor = ctx.get('configEditor');
  } catch {
    return routes;
  }
  if (!editor || typeof editor.configuration !== 'function') return routes;

  let rows;
  try {
    rows = editor.configuration();
  } catch {
    return routes;
  }
  if (!Array.isArray(rows)) return routes;

  for (const row of rows) {
    const id = row?.entry?.options?.id;
    if (typeof id !== 'string') continue;
    const inherited = row.inherited && typeof row.inherited === 'object' ? row.inherited : {};
    const override = row.override && typeof row.override === 'object' ? row.override : {};
    const config = { ...inherited, ...override };

    if (id === 'llm-pi-ai' && config.providers && typeof config.providers === 'object') {
      for (const [provider, profile] of Object.entries(config.providers)) {
        if (!profile || typeof profile !== 'object') continue;
        if (typeof profile.baseURL !== 'string' || profile.baseURL.length === 0) continue;
        routes[provider] = {
          baseURL: profile.baseURL,
          apiKeyEnv: typeof profile.apiKeyEnv === 'string' ? profile.apiKeyEnv : undefined,
        };
      }
    } else if (id === 'llm-deepseek') {
      if (typeof config.baseURL !== 'string' || config.baseURL.length === 0) continue;
      routes['deepseek-official'] = {
        baseURL: config.baseURL,
        apiKeyEnv: typeof config.apiKeyEnv === 'string' ? config.apiKeyEnv : 'DEEPSEEK_API_KEY',
      };
    }
  }
  return routes;
}

/** Normalize the `autoDiscover` knob into its effective options. */
function discoveryOptions(autoDiscover) {
  const options = autoDiscover && typeof autoDiscover === 'object' ? autoDiscover : {};
  const providers = options.providers && typeof options.providers === 'object' ? options.providers : {};
  const refreshMinutes =
    Number.isFinite(options.refreshMinutes) && options.refreshMinutes > 0 ? options.refreshMinutes : 360;
  return { providers, refreshMinutes, includeConfigured: options.includeConfigured !== false };
}

/** Build the endpoint list to query, with explicit entries overriding composed routes. */
function discoveryTargets(ctx, autoDiscover) {
  const { providers, includeConfigured } = discoveryOptions(autoDiscover);
  const targets = new Map();

  const add = (provider, spec) => {
    if (typeof provider !== 'string' || provider.length === 0) return;
    if (!spec || typeof spec !== 'object') return;
    if (typeof spec.baseURL !== 'string' || spec.baseURL.length === 0) return;
    targets.set(provider, {
      provider,
      baseURL: spec.baseURL,
      apiKeyEnv: typeof spec.apiKeyEnv === 'string' ? spec.apiKeyEnv : undefined,
      units: spec.units === 'perToken' || spec.units === 'perMillion' ? spec.units : 'auto',
    });
  };

  if (includeConfigured) {
    for (const [provider, spec] of Object.entries(composedRouteProfiles(ctx))) add(provider, spec);
  }
  for (const [provider, spec] of Object.entries(providers)) {
    add(provider, typeof spec === 'string' ? { baseURL: spec } : spec);
  }
  return [...targets.values()];
}

/** Resolve a route's API key through the credential seam, then the environment. */
async function resolveTargetKey(ctx, target) {
  if (typeof target.apiKeyEnv !== 'string' || target.apiKeyEnv.length === 0) return undefined;

  let credentials;
  try {
    credentials = ctx.get('credentials');
  } catch {
    credentials = undefined;
  }
  if (credentials && typeof credentials.resolve === 'function') {
    try {
      const hit = await credentials.resolve(target.apiKeyEnv);
      if (hit && typeof hit.value === 'string' && hit.value.length > 0) return hit.value;
    } catch {
      // Fall through to the process environment.
    }
  }
  const fromEnv = typeof process !== 'undefined' && process.env ? process.env[target.apiKeyEnv] : undefined;
  return typeof fromEnv === 'string' && fromEnv.length > 0 ? fromEnv : undefined;
}

/** Query one provider's /models endpoint and extract every published rate. */
async function fetchProviderRates(target, apiKey) {
  if (typeof fetch !== 'function') throw new Error('fetch is unavailable');
  const url = `${target.baseURL.replace(/\/+$/, '')}/models`;
  const headers = { accept: 'application/json' };
  if (typeof apiKey === 'string' && apiKey.length > 0) headers.authorization = `Bearer ${apiKey}`;
  const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(15000) : undefined;

  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    // Surface the relay's own reason (for example a group-permission denial)
    // instead of a bare status code; never echo request headers or keys.
    let detail = '';
    try {
      const parsed = JSON.parse(await response.text());
      detail = parsed?.error?.message ?? parsed?.message ?? '';
    } catch {
      // Non-JSON error body: keep the status only.
    }
    const suffix = typeof detail === 'string' && detail.length > 0 ? `: ${detail.slice(0, 160)}` : '';
    throw new Error(`HTTP ${response.status}${suffix}`);
  }
  const body = await response.json();
  const models = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.models)
        ? body.models
        : [];

  const rates = new Map();
  for (const model of models) {
    const id = model && typeof model.id === 'string' ? model.id : undefined;
    if (!id) continue;
    const normalized = normalizeDiscoveredPricing(model.pricing ?? model.cost ?? model.price, target.units);
    if (normalized) rates.set(id, normalized);
  }
  return rates;
}

/**
 * Best-effort discovery over every configured route. Never throws: a provider
 * that is unreachable, unauthorized, or publishes no price is recorded in the
 * report and otherwise ignored.
 */
async function runPricingDiscovery(ctx, registry, autoDiscover) {
  const report = {};
  const targets = discoveryTargets(ctx, autoDiscover);

  await Promise.all(
    targets.map(async (target) => {
      try {
        const apiKey = await resolveTargetKey(ctx, target);
        const rates = await fetchProviderRates(target, apiKey);
        for (const [model, pricing] of rates) registry.discover(target.provider, model, pricing);
        report[target.provider] = { ok: true, priced: rates.size };
      } catch (error) {
        report[target.provider] = {
          ok: false,
          priced: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  registry.discoveryReport = report;
  return report;
}

// ---------------------------------------------------------------------------
// Projection definition
// ---------------------------------------------------------------------------

const COST_USAGE_KEY = 'costUsage';

function buildRouteKey(provider, model) {
  return `${provider}/${model}`;
}

function initCostUsageState() {
  return {
    totalInputCost: 0,
    totalOutputCost: 0,
    totalCacheReadCost: 0,
    totalCacheWriteCost: 0,
    totalCost: 0,
    routes: {},
  };
}

/**
 * The `costUsage` projection unit: a pure fold of assistant/message events
 * into session-wide cost accumulators.
 */
const costUsageProjectionDefinition = {
  key: COST_USAGE_KEY,
  // Bump when the state shape changes: cached rows at an older version are
  // discarded and the session log re-folds from scratch (the projection cache
  // falls back to a full fold on a version mismatch).
  stateVersion: 2,
  stateSchema: costUsageStateSchema,
  init: initCostUsageState,

  apply: (state, event) => {
    // Fold onto a copy; the registry detects changes by reference.
    const next = { ...state };

    if (event.type !== 'assistant/message') return next;
    if (!event.data.usage) return next;
    if (!event.data.message?.source) return next;

    const source = event.data.message.source;
    if (source.kind !== 'model') return next;

    const provider = source.provider;
    const model = source.model;
    const usage = event.data.usage;

    // Access the pricing registry — stored as a weak reference on the module
    const registry = /** @type {PricingRegistry} */ currentRegistry;
    if (!registry) return next;

    const pricing = registry.get(provider, model);
    if (!pricing) return next;

    const costs = pricing.costFor(usage);
    if (!costs) return next;

    // Update session totals
    next.totalInputCost += costs.inputCost;
    next.totalOutputCost += costs.outputCost;
    next.totalCacheReadCost += costs.cacheReadCost;
    next.totalCacheWriteCost += costs.cacheWriteCost;
    next.totalCost += costs.inputCost + costs.outputCost + costs.cacheReadCost + costs.cacheWriteCost;

    // Update per-route accumulators
    const routeKey = buildRouteKey(provider, model);
    const existingRoute = next.routes[routeKey];
    next.routes = {
      ...next.routes,
      [routeKey]: {
        provider,
        model,
        inputCost: (existingRoute?.inputCost ?? 0) + costs.inputCost,
        outputCost: (existingRoute?.outputCost ?? 0) + costs.outputCost,
        cacheReadCost: (existingRoute?.cacheReadCost ?? 0) + costs.cacheReadCost,
        cacheWriteCost: (existingRoute?.cacheWriteCost ?? 0) + costs.cacheWriteCost,
        totalCost: (existingRoute?.totalCost ?? 0) + costs.inputCost + costs.outputCost + costs.cacheReadCost + costs.cacheWriteCost,
      },
    };

    return next;
  },

  wire: {
    viewSchema: costUsageViewSchema,
    view: (state) => {
      const routeViews = {};
      for (const [key, r] of Object.entries(state.routes)) {
        routeViews[key] = {
          provider: r.provider,
          model: r.model,
          totalCost: r.totalCost,
        };
      }
      return {
        currency: currentRegistry?.currency ?? '$',
        totalCost: state.totalCost,
        totalInputCost: state.totalInputCost,
        totalOutputCost: state.totalOutputCost,
        totalCacheReadCost: state.totalCacheReadCost,
        totalCacheWriteCost: state.totalCacheWriteCost,
        routes: routeViews,
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Cordis plugin registration
// ---------------------------------------------------------------------------

/** @type {PricingRegistry | null} */
let currentRegistry = null;

/** Cordis plugin name. */
export const name = 'cost-usage';

/** Inject into the sessionProjections service. */
export const inject = ['sessionProjections'];

/**
 * The projection unit, exported for tests and for other host plugins that want
 * to fold the same events without registering a second key.
 */
export { costUsageProjectionDefinition };

/**
 * Register the `costUsage` projection and wire up pricing configuration.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis context.
 * @param {Object} [config] - Plugin configuration from the entry's `config` field.
 */
export function apply(ctx, config = {}) {
  const registry = new PricingRegistry();
  currentRegistry = registry;

  // Configure immediately from the entry configuration (second argument).
  // Cordis invokes function plugins as (ctx, config); a patch reload re-runs
  // apply with the updated config, so no listeners are needed.
  registry.configure(config.pricing, config.currency);

  // Register the projection. Cordis disposes this registration together with
  // the fiber, so anything that throws after it would silently remove the key
  // again — leave the failure loud instead of swallowing it.
  ctx.sessionProjections.register(costUsageProjectionDefinition);

  // Optional discovery: read each configured route's /models endpoint and
  // adopt any published per-model rates. Best effort and silent by design;
  // `costUsage.discoveryReport` records what happened.
  const autoDiscover = config.autoDiscover;
  const discoveryEnabled =
    autoDiscover === true ||
    (autoDiscover !== null && typeof autoDiscover === 'object' && autoDiscover.enabled !== false);
  if (discoveryEnabled) {
    const { refreshMinutes } = discoveryOptions(autoDiscover);
    const run = () => {
      runPricingDiscovery(ctx, registry, autoDiscover).catch(() => {});
    };
    // Give the credential store and the profile composition a moment to settle.
    const initial = setTimeout(run, 3000);
    const timer = setInterval(run, refreshMinutes * 60_000);
    if (typeof timer.unref === 'function') timer.unref();
    ctx.effect(() => () => {
      clearTimeout(initial);
      clearInterval(timer);
    });
  }

  // Expose the pricing registry for other plugins to query. Cordis refuses a
  // bare property assignment here ("cannot set property without provide"), and
  // that throw used to take the projection down with it: `ctx.provide()` is the
  // supported form and rides this fiber like any other effect.
  ctx.provide('costUsage', {
    pricing: registry,
    projectionKey: COST_USAGE_KEY,
    get discoveryReport() {
      return registry.discoveryReport;
    },
  });
}

export {
  PricingRegistry,
  composedRouteProfiles,
  discoveryTargets,
  normalizeDiscoveredPricing,
  parsePricingField,
  runPricingDiscovery,
};

// ---------------------------------------------------------------------------
// Module declaration for TypeScript consumers
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CostUsageView
 * @property {number} totalCost
 * @property {number} totalInputCost
 * @property {number} totalOutputCost
 * @property {number} totalCacheReadCost
 * @property {number} totalCacheWriteCost
 * @property {Object<string, {provider: string, model: string, totalCost: number}>} routes
 */

/**
 * @typedef {Object} CostUsageService
 * @property {PricingRegistry} pricing
 * @property {string} projectionKey
 */