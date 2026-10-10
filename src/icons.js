import React from 'react';
const h = React.createElement;
const paths = {
  sparkles: ['m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z', 'M20 2v4M18 4h4'],
  sliders: ['M4 7h6m4 0h6M4 17h10m4 0h2', 'M10 4v6m4 4v6'],
  layers: ['m12 3 9 5-9 5-9-5 9-5Z', 'm3 12 9 5 9-5M3 16l9 5 9-5'],
  chart: ['M4 3v17h17M8 15v-4m5 4V7m5 8v-6'],
  gauge: ['M5 18a9 9 0 1 1 14 0', 'm12 13 4-5M8 18h8'],
  cpu: ['M8 3v3m4-3v3m4-3v3M8 18v3m4-3v3m4-3v3M3 8h3m-3 4h3m-3 4h3m12-8h3m-3 4h3m-3 4h3', 'M6 6h12v12H6zM9 9h6v6H9z'],
  database: ['M4 6c0-4 16-4 16 0s-16 4-16 0Z', 'M4 6v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0'],
  info: ['M12 11v6M12 7h.01', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  check: ['m5 12 4 4L19 6'],
  warning: ['m12 3 10 18H2L12 3Z', 'M12 9v5m0 3h.01'],
  arrow: ['M4 12h16m-6-6 6 6-6 6'],
  target: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12 11v2']
};
export function Icon({ name = 'info', className = '' }) {
  return h('svg', { className: `dgui-icon ${className}`, width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
    (paths[name] ?? paths.info).map((d, i) => h('path', { key: i, d })));
}
