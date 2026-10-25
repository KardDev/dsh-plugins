/**
 * dsh-cost-usage — browser half.
 *
 * Registers one entry in `conversation.composer.dock`, the list slot that sits
 * in the same row as the context meter, and renders the session cost from the
 * `costUsage` projection. The slot hands every entry a `useProjection` hook,
 * so this half never touches the DOM: no observers, no injected nodes, no
 * assumptions about host markup.
 *
 * @module dsh-cost-usage/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-cost-usage',
  factory(require) {
    var React = require('react');
    var h = React.createElement;

    var PROJECTION_KEY = 'costUsage';
    var PRE = 'dsh-cost-';
    var warnedMissing = false;

    // Theme tokens only; the pill mirrors the context meter's trigger styling.
    var CSS_TEXT =
      '.' + PRE + 'wrap{position:relative;display:inline-flex;flex:none;align-items:center}' +
      '.' + PRE + 'pill{border-radius:var(--dsw-radius-sm,4px);color:var(--dsw-alias-label-tertiary,#8b8b8b);' +
      'font:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-variant-numeric:tabular-nums;' +
      'line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;cursor:pointer;' +
      'background:0 0;border:none;flex:none;align-items:center;gap:4px;padding:1px 8px;display:inline-flex;user-select:none}' +
      '.' + PRE + 'pill:hover{background:var(--dsw-alias-interactive-bg-hover,transparent);color:var(--dsw-alias-label-secondary)}' +
      '.' + PRE + 'panel{position:fixed;z-index:1000;min-width:264px;max-width:320px;padding:12px 14px;' +
      'background:var(--dsw-alias-bg-primary,#1e1e1e);border:1px solid var(--dsw-alias-border-l3,#333);' +
      'border-radius:var(--dsw-radius-lg,12px);box-shadow:var(--dsw-elevation-panel,0 8px 32px rgba(0,0,0,.4));' +
      'font-size:13px;line-height:20px;text-align:left}' +
      '.' + PRE + 'panelTitle{margin:0 0 10px;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,#e0e0e0)}' +
      '.' + PRE + 'row{display:flex;justify-content:space-between;gap:16px;padding:2px 0;color:var(--dsw-alias-label-secondary,#8b8b8b)}' +
      '.' + PRE + 'value{color:var(--dsw-alias-label-primary,#e0e0e0);font-variant-numeric:tabular-nums}' +
      '.' + PRE + 'routes{margin:8px 0 0;padding:8px 0 0;border-top:1px solid var(--dsw-alias-border-l3,#333)}' +
      '.' + PRE + 'routeLabel{color:var(--dsw-alias-label-tertiary,#8b8b8b);word-break:break-all}' +
      '.' + PRE + 'total{margin:8px 0 0;padding:8px 0 0;border-top:1px solid var(--dsw-alias-border-l3,#333);' +
      'display:flex;justify-content:space-between;font-weight:500;color:var(--dsw-alias-label-primary,#e0e0e0)}';

    /** Format a cost for the pill and the breakdown. */
    function formatCost(value, currency) {
      var symbol = typeof currency === 'string' && currency.length > 0 ? currency : '$';
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return symbol + '0.00';
      if (value < 0.01) return symbol + value.toFixed(4);
      if (value < 1) return symbol + value.toFixed(3);
      return symbol + value.toFixed(2);
    }

    function row(label, value, key) {
      return h('div', { className: PRE + 'row', key: key },
        h('span', null, label),
        h('span', { className: PRE + 'value' }, value));
    }

    /**
     * Cost pill plus its breakdown panel. Hooks run before any early return so
     * the hook order stays stable once the projection starts reporting.
     */
    function CostPill(props) {
      var useProjection = props.useProjection;
      var data = typeof useProjection === 'function' ? useProjection(PROJECTION_KEY) : undefined;

      var openPair = React.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      var anchorPair = React.useState(null);
      var anchor = anchorPair[0];
      var setAnchor = anchorPair[1];
      var ref = React.useRef(null);

      React.useEffect(function () {
        if (!open) return undefined;
        var close = function () { setOpen(false); };
        var onKey = function (event) { if (event.key === 'Escape') close(); };
        var onPointerDown = function (event) {
          // Close on interaction outside both the panel and the pill that
          // toggles it; clicks inside stay interactive.
          var panel = document.querySelector('[data-dsh-cost-panel]');
          if (panel && panel.contains(event.target)) return;
          if (ref.current && ref.current.contains(event.target)) return;
          close();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('resize', close);
        return function () {
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('pointerdown', onPointerDown, true);
          window.removeEventListener('resize', close);
        };
      }, [open]);

      if (data === undefined) {
        // The host half is either unloaded or its registration failed. Rendering a
        // placeholder rather than nothing keeps the two failure modes apart on
        // screen: no pill at all means THIS entry never mounted.
        if (!warnedMissing) {
          warnedMissing = true;
          console.warn('[dsh-cost-usage] projection "' + PROJECTION_KEY + '" is unavailable — check that the host half loaded and registered it.');
        }
        return h('span', { className: PRE + 'wrap' },
          h('style', { 'data-plugin': 'dsh-cost-usage' }, CSS_TEXT),
          h('span', {
            className: PRE + 'pill',
            style: { cursor: 'default', opacity: '0.6' },
            title: 'Session cost unavailable — the costUsage projection is not registered',
          }, 'cost —'));
      }

      var currency = data.currency;
      var total = formatCost(data.totalCost, currency);

      var toggle = function () {
        if (open) {
          setOpen(false);
          return;
        }
        var element = ref.current;
        var rect = element && typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
        setAnchor(rect ? { left: rect.left, bottom: rect.top } : null);
        setOpen(true);
      };

      var panel = null;
      if (open) {
        var width = 300;
        var left = anchor ? Math.max(8, Math.min(anchor.left, (window.innerWidth || width) - width - 8)) : 8;
        var bottom = anchor ? Math.max(8, (window.innerHeight || 0) - anchor.bottom + 6) : 8;
        var routes = data.routes && typeof data.routes === 'object' ? Object.keys(data.routes) : [];
        panel = h('div', {
          className: PRE + 'panel',
          role: 'dialog',
          'aria-label': 'Session cost breakdown',
          'data-dsh-cost-panel': 'true',
          tabIndex: -1,
          ref: function (node) { if (node) node.focus({ preventScroll: true }); },
          style: { left: left + 'px', bottom: bottom + 'px' },
        },
          h('p', { className: PRE + 'panelTitle' }, 'Session cost'),
          row('Input', formatCost(data.totalInputCost, currency), 'in'),
          row('Output', formatCost(data.totalOutputCost, currency), 'out'),
          row('Cache read', formatCost(data.totalCacheReadCost, currency), 'cr'),
          row('Cache write', formatCost(data.totalCacheWriteCost, currency), 'cw'),
          routes.length > 0
            ? h('div', { className: PRE + 'routes' },
                routes.map(function (key) {
                  var route = data.routes[key] || {};
                  return row(route.provider && route.model ? route.provider + ' / ' + route.model : key, formatCost(route.totalCost, currency), key);
                }))
            : null,
          h('div', { className: PRE + 'total' }, h('span', null, 'Total'), h('span', { className: PRE + 'value' }, total)));
      }

      return h('span', { className: PRE + 'wrap' },
        h('style', { 'data-plugin': 'dsh-cost-usage' }, CSS_TEXT),
        h('button', {
          ref: ref,
          type: 'button',
          className: PRE + 'pill',
          title: 'Session cost — click for breakdown',
          'aria-haspopup': 'dialog',
          'aria-expanded': open ? 'true' : 'false',
          'aria-label': 'Session cost ' + total,
          onClick: toggle,
        }, total),
        panel);
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // The dock already allocates space in the composer row the context
        // meter lives in, so the pill lands beside it without touching it.
        ctx.slots.inject('conversation.composer.dock', function () {
          return ctx.slots.register({
            name: 'conversation.composer.dock',
            id: 'cost',
            order: 10,
          }, CostPill);
        });
      },
    };
  },
});