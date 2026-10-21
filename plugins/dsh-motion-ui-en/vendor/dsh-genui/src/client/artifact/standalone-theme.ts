/** standalone 页面使用的基础颜色和版面样式。 */
export const STANDALONE_THEME_CSS = `
:root {
  color-scheme: light;
  --dsw-static-neutral-bluish-00: rgb(255, 255, 255);
  --dsw-static-neutral-bluish-50: rgb(249, 250, 251);
  --dsw-static-neutral-bluish-300: rgb(207, 211, 214);
  --dsw-static-neutral-bluish-400: rgb(173, 178, 184);
  --dsw-static-neutral-bluish-600: rgb(129, 133, 140);
  --dsw-static-neutral-bluish-700: rgb(97, 102, 107);
  --dsw-static-neutral-bluish-800: rgb(53, 54, 56);
  --dsw-static-neutral-bluish-850: rgb(44, 44, 46);
  --dsw-static-neutral-bluish-875: rgb(35, 35, 36);
  --dsw-static-neutral-bluish-900: rgb(27, 27, 28);
  --dsw-static-neutral-bluish-950: rgb(21, 21, 23);
  --dsw-static-neutral-bluish-1000: rgb(15, 17, 21);
  --dsw-alias-bg-base: var(--dsw-static-neutral-bluish-00);
  --dsw-alias-bg-layer-1: var(--dsw-static-neutral-bluish-00);
  --dsw-alias-bg-layer-2: var(--dsw-static-neutral-bluish-00);
  --dsw-alias-bg-layer-3: var(--dsw-static-neutral-bluish-00);
  --dsw-alias-border-l1: rgba(0, 0, 0, 0.04);
  --dsw-alias-border-l2: rgba(0, 0, 0, 0.1);
  --dsw-alias-fill-hover: #eef2f7;
  --dsw-alias-label-primary: var(--dsw-static-neutral-bluish-1000);
  --dsw-alias-label-secondary: var(--dsw-static-neutral-bluish-700);
  --dsw-alias-label-tertiary: var(--dsw-static-neutral-bluish-600);
  --dsw-alias-label-caption: var(--dsw-static-neutral-bluish-400);
  --dsw-alias-markdown-code-block: var(--dsw-static-neutral-bluish-50);
  --dsw-alias-markdown-hr: #cbd5e1;
  /* DSH 静态调色板供语义状态别名使用。 */
  --dsw-static-deepseek-100: rgb(228, 237, 253);
  --dsw-static-deepseek-400: rgb(122, 170, 255);
  --dsw-static-deepseek-500: rgb(65, 118, 230);
  --dsw-static-deepseek-800: rgb(52, 65, 91);
  --dsw-static-green-100: rgb(230, 250, 237);
  --dsw-static-green-400: rgb(78, 209, 126);
  --dsw-static-green-500: rgb(34, 197, 94);
  --dsw-static-green-900: rgb(35, 60, 44);
  --dsw-static-amber-100: rgb(254, 245, 231);
  --dsw-static-amber-400: rgb(247, 173, 49);
  --dsw-static-amber-500: rgb(245, 158, 11);
  --dsw-static-amber-600: rgb(221, 134, 41);
  --dsw-static-amber-900: rgb(39, 36, 31);
  --dsw-static-red-400: rgb(242, 90, 90);
  --dsw-static-red-600: rgb(236, 19, 19);

  /* DSH 浅色主题语义状态别名。 */
  --dsw-alias-state-business-primary: var(--dsw-static-deepseek-500);
  --dsw-alias-state-business-tertiary: var(--dsw-static-deepseek-100);
  --dsw-alias-state-success-primary: var(--dsw-static-green-500);
  --dsw-alias-state-success-secondary: var(--dsw-static-green-400);
  --dsw-alias-state-success-tertiary: var(--dsw-static-green-100);
  --dsw-alias-state-warn-label: var(--dsw-static-amber-600);
  --dsw-alias-state-warn-primary: var(--dsw-static-amber-500);
  --dsw-alias-state-warn-secondary: var(--dsw-static-amber-400);
  --dsw-alias-state-warn-tertiary: var(--dsw-static-amber-100);
  --dsw-alias-state-error-primary: var(--dsw-static-red-600);
  --dsw-alias-state-error-secondary: var(--dsw-static-red-400);
  --dsw-static-deepseek-300: rgb(183, 200, 254);
  --dsw-static-deepseek-450: rgb(86, 134, 254);
  --dsw-static-blue-450: rgb(77, 147, 248);
}
body[data-ds-dark-theme] {
  color-scheme: dark;
  --dsw-alias-bg-base: var(--dsw-static-neutral-bluish-950);
  --dsw-alias-bg-layer-1: var(--dsw-static-neutral-bluish-875);
  --dsw-alias-bg-layer-2: var(--dsw-static-neutral-bluish-850);
  --dsw-alias-bg-layer-3: var(--dsw-static-neutral-bluish-800);
  --dsw-alias-border-l1: rgba(255, 255, 255, 0.06);
  --dsw-alias-border-l2: rgba(255, 255, 255, 0.12);
  --dsw-alias-fill-hover: #2b3542;
  --dsw-alias-label-primary: var(--dsw-static-neutral-bluish-50);
  --dsw-alias-label-secondary: var(--dsw-static-neutral-bluish-300);
  --dsw-alias-label-tertiary: var(--dsw-static-neutral-bluish-400);
  --dsw-alias-label-caption: var(--dsw-static-neutral-bluish-600);
  --dsw-alias-markdown-code-block: var(--dsw-static-neutral-bluish-900);
  --dsw-alias-markdown-hr: #465365;
  /* DSH 深色主题语义状态别名。 */
  --dsw-alias-state-business-primary: var(--dsw-static-deepseek-400);
  --dsw-alias-state-business-tertiary: var(--dsw-static-deepseek-800);
  --dsw-alias-state-success-primary: var(--dsw-static-green-500);
  --dsw-alias-state-success-secondary: var(--dsw-static-green-400);
  --dsw-alias-state-success-tertiary: var(--dsw-static-green-900);
  --dsw-alias-state-warn-label: var(--dsw-static-amber-600);
  --dsw-alias-state-warn-primary: var(--dsw-static-amber-500);
  --dsw-alias-state-warn-secondary: var(--dsw-static-amber-400);
  --dsw-alias-state-warn-tertiary: var(--dsw-static-amber-900);
  --dsw-alias-state-error-primary: var(--dsw-static-red-400);
  --dsw-alias-state-error-secondary: var(--dsw-static-red-400);
}
html { min-height: 100%; }
body { margin: 0; min-height: 100vh; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
#genui-root { width: min(1200px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 56px; }
`
