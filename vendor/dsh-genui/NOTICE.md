# dsh-genui component compatibility core

Source: https://github.com/omdsh-dev/dsh-genui, version 0.11.4.
Commit: 7ff0cf5ea474573a86a912e0cfe938ce8093a66f.
The adjacent LICENSE preserves the upstream MIT copyright and permission notice.
Motion UI embeds the component renderer and validator, not the upstream host
plugin. Host tools, persistence, styling guidance and presentation remain owned
by Motion UI. Build-time adapters replace the optional DSH primitive dependency
with upstream's standalone primitives and expose the file-link context.
Quiz answers additionally participate in Motion UI's persisted form state;
internal quiz keys are excluded from form submission collection. Engine
versions are upgraded to patched builds and covered by browser fixtures.

Upstream files are retained for reproducible builds; only the reachable browser
and validation graph is bundled. Heavy engines load from our authenticated host
routes on demand. No upstream host plugin is registered.

Motion UI additionally adapts common optional stable component IDs, widget/view
state persistence (plot parameters/viewport, sorting, tabs, accordion, switches
and unnamed local controls), and internal-state submission filtering. Both live
and standalone runtimes use these adapters. Automatic animation frames remain
transient; persistent state is updated by explicit user parameter/view changes.

Motion UI adapts text copyable/title and code title/wrap fields to its shared rounded copy panel. Live and standalone views share clipboard feedback and literal source copying.

Card/stat nodes expose scoped component markers so guided-mode native styling can cover mixed extended/native documents without depending on generated class names.
