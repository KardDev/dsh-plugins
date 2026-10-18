# Issue #4: secondary native geometry under skin patches

Report: https://github.com/Scorp1o117/dsh-motion-ui/issues/4

The reported important reset is the same skin-center patches rule identified in #3. Version 0.8.6 protected primary native containers but omitted steps and callouts, along with several secondary native surfaces. This is a plugin coverage omission.

The owned boundary now includes steps, dots, callouts, buttons, badges, controls, toggles and their thumb pseudo-element, progress containers, menus and copy blocks. Each element keeps its original cascade-resolved geometry, including intentional square corners, asymmetric corners and responsive values. Lazy copy-block styles record their own radius tokens so free-mode blocks do not inherit a parent's geometry. The boundary remains scoped to native documents and excludes style previews and iframe contents.

Regression cases use the reporter's exact HTML skin attribute, chat-flow ancestor and reset for elements and before/after pseudo-elements. Explicit assertions cover prismframe steps at 18px, callouts at 0/10/10/0 and toggle thumbs at 50%; the multi-style matrix also compares every corner with the original unskinned geometry.
