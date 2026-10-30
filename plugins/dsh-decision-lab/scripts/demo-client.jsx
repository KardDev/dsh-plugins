import React from 'react';
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
// Test/demo adapter only. Production registers against DSH's real slot service.
window.__ModuleLoader__ = {
  load({ id, factory }) {
    if (id !== 'dsh-decision-lab') throw Error('Unexpected module');
    const plugin = factory(name => { if (name === 'react') return React; throw Error(`Unexpected import: ${name}`); });
    plugin.apply({ slots: {
      inject(name, callback) { if (name !== 'tool.call.toolview') throw Error('Unexpected slot'); return callback(); },
      register(spec, View) {
        if (spec.key !== 'decision_lab') throw Error('Unexpected slot key');
        window.__labRender = props => root.render(<View {...props} />);
        window.__labRender(JSON.parse(document.getElementById('fixture').textContent));
      },
    } });
  },
};
