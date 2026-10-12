// Shared attribute vocabulary for validation and model-facing capability discovery.
const define = (fields, purpose, presentation = '') => Object.freeze({ fields: Object.freeze(fields), purpose, presentation });
export const COMPONENTS = Object.freeze({
  visual: define(['spec','stateKey','warnings'], 'Extended native charts, tables, plots, quiz, forms, diagrams, media and 3D'),
  heading: define(['text','spans','size','weight','color','align','lineHeight'], 'Section heading', 'tone'), text: define(['text','spans','size','weight','color','align','lineHeight','copyable','title'], 'Readable explanation; copyable:true adds a reusable text panel', 'tone'),
  code: define(['code','lang','title','wrap'], 'Literal copyable code; displayed only, never executed'),
  callout: define(['text','spans','size','weight','color','align','lineHeight'], 'A short emphasized paragraph', 'tone'),
  row: define(['children','columns','gap'], 'Wrapping parallel content'), column: define(['children','gap'], 'Ordered vertical content'),
  card: define(['title', 'children', 'surface'], 'Meaningful grouped section', 'tone'),
  details: define(['title', 'children', 'open'], 'Collapsible supporting content', 'tone'),
  badge: define(['text'], 'Short explicit status label', 'tone'),
  progress: define(['label', 'value', 'max', 'unit'], 'Declared numeric progress snapshot', 'tone'),
  steps: define(['title','items'], 'Ordered declared steps with an optional heading'),
  metric: define(['label', 'value', 'unit', 'decimals'], 'Number with units, or a literal/bound status string', 'tone'),
  input: define(['label', 'bind'], 'String or numeric state input'), slider: define(['label', 'bind'], 'Numeric state control'),
  select: define(['label', 'bind'], 'Selection from declared state options'), toggle: define(['label', 'bind'], 'Boolean state control'),
  button: define(['text', 'action','href','path','variant'], 'Agent follow-up, web link or host file opener', 'icon'),
  link: define(['text','href','path','variant'], 'User-clicked webpage or local file button', 'icon'),
  divider: define(['label'], 'Quiet section divider'),
  table: define(['label', 'rows', 'columns'], 'Supplied or derived values; inline rows or data/derived reference'),
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
