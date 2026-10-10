// Shared attribute vocabulary for validation and model-facing capability discovery.
const define = (fields, purpose, presentation = '') => Object.freeze({ fields: Object.freeze(fields), purpose, presentation });
export const COMPONENTS = Object.freeze({
  heading: define(['text'], 'Section heading', 'tone'), text: define(['text'], 'Readable explanation or bound text', 'tone'),
  row: define(['children'], 'Wrapping parallel content'), column: define(['children'], 'Ordered vertical content'),
  card: define(['title', 'children', 'surface'], 'Meaningful grouped section', 'tone'),
  details: define(['title', 'children', 'open'], 'Collapsible supporting content', 'tone'),
  badge: define(['text'], 'Short explicit status label', 'tone'),
  progress: define(['label', 'value', 'max', 'unit'], 'Declared numeric progress snapshot', 'tone'),
  steps: define(['items'], 'Ordered declared steps'),
  metric: define(['label', 'value', 'unit', 'decimals'], 'Numeric result with units', 'tone'),
  input: define(['label', 'bind'], 'String or numeric state input'), slider: define(['label', 'bind'], 'Numeric state control'),
  select: define(['label', 'bind'], 'Selection from declared state options'), toggle: define(['label', 'bind'], 'Boolean state control'),
  button: define(['text', 'action'], 'Declared Agent follow-up', 'icon'),
  table: define(['rows', 'columns'], 'Exact supplied or derived values'),
  chart: define(['kind', 'rows', 'labelKey', 'valueKey', 'label', 'unit', 'xScale'], 'Bar/line comparison with accessible data'),
  sandbox: define(['title', 'html', 'css', 'script', 'fallback', 'height', 'stateKeys', 'dataKeys', 'derivedKeys'], 'Freeform isolated HTML/SVG/CSS/JavaScript visualization')
});
export function componentFields(type) {
  const c = Object.hasOwn(COMPONENTS, type) ? COMPONENTS[type] : undefined;
  return c && ['id', 'type', ...c.fields, ...(c.presentation ? ['icon'] : []), ...(c.presentation === 'tone' ? ['tone'] : [])];
}
export function componentCatalog() {
  return Object.fromEntries(Object.entries(COMPONENTS).map(([type, c]) => [type, { fields: componentFields(type), purpose: c.purpose }]));
}
export function componentGuide() {
  return Object.entries(COMPONENTS).map(([type]) => `${type} {${componentFields(type).join(',')}}`).join('; ');
}
