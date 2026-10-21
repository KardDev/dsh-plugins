// Geometry only: no source rewriting, shadow removal, or clipping as a repair.
// Serialized into the isolated frame together with fitTextCards.
export function inspectTextCards(root, cards) {
  const result = [];
  const cache = new WeakMap(), styleOf = el => { if (!cache.has(el)) cache.set(el, getComputedStyle(el)); return cache.get(el); };
  for (const card of cards ?? [...root.querySelectorAll('article,section,aside,figure,div')].slice(0, 256).reverse()) {
    if (card.closest('#stage,svg,pre,code,[role=img],[data-motion-layout=preserve]')) continue;
    const css = styleOf(card), box = card.getBoundingClientRect();
    const radius = Math.max(parseFloat(css.borderBottomLeftRadius) || 0, parseFloat(css.borderBottomRightRadius) || 0);
    if (box.width < 120 || box.height < 24 || css.display === 'none' || css.visibility === 'hidden') continue;
    if (/auto|scroll/.test(css.overflowY)) continue;
    if (!radius && css.boxShadow === 'none') continue;
    const padding = parseFloat(css.paddingBottom) || 0, border = parseFloat(css.borderBottomWidth) || 0;
    const bottom = box.bottom - padding - border;
    let excess = 0, corner = false, target, flow = !['absolute', 'fixed'].includes(css.position) && css.transform === 'none' && !/auto|scroll/.test(css.overflowY) && !/size/.test(css.contain) && !css.borderBottomLeftRadius.includes('%') && !css.borderBottomRightRadius.includes('%') && !(css.transitionDuration.split(',').some(v => parseFloat(v) > 0) && /(^|,|\s)(height|max-height|all)(,|\s|$)/.test(css.transitionProperty));
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT); let text, count = 0;
    while ((text = walker.nextNode()) && ++count <= 128) {
      if (!text.textContent.trim()) continue;
      const el = text.parentElement;
      if (el.closest('svg,pre,code,script,style,textarea,[role=img]')) continue;
      const style = styleOf(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (style.webkitLineClamp && style.webkitLineClamp !== 'none') continue;
      let intentional = false;
      for (let parent = el; parent && parent !== card; parent = parent.parentElement) {
        const c = styleOf(parent);
        if (/auto|scroll/.test(c.overflowY) || (c.webkitLineClamp && c.webkitLineClamp !== 'none')) { intentional = true; break; }
      }
      if (intentional) continue;
      const range = document.createRange(); range.selectNode(text);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        const amount = rect.bottom - bottom;
        // Keep the last line out of a rounded bottom corner, even if overflow is visible.
        const r = Math.min(radius, box.height / 2, box.width / 2);
        const progress = r ? Math.max(0, Math.min(1, (rect.bottom - (box.bottom - r)) / r)) : 0;
        const inset = r * (1 - Math.sqrt(1 - progress * progress));
        const touchesCorner = progress > 0 && (rect.left < box.left + inset - 1 || rect.right > box.right - inset + 1);
        if (amount <= 1 && !touchesCorner) continue;
        target = el; excess = Math.max(excess, amount); corner ||= touchesCorner;
        for (let parent = el; parent && parent !== card; parent = parent.parentElement) {
          const c = styleOf(parent);
          if (['absolute', 'fixed'].includes(c.position) || c.transform !== 'none' || /auto|scroll/.test(c.overflowY) || (c.webkitLineClamp && c.webkitLineClamp !== 'none')) flow = false;
        }
      }
    }
    if (target) result.push({card, target, excess, corner, radius, flow});
  }
  return result;
}

export function fitTextCards(root, inspect) {
  // Re-measure inner cards first so an outer container sees their final dimensions.
  for (const {card} of inspect(root)) {
    const issue = inspect(root, [card])[0];
    if (!issue?.flow) continue;
    const css = getComputedStyle(card), box = card.getBoundingClientRect();
    if (issue.corner) card.style.setProperty('padding-bottom', Math.max(parseFloat(css.paddingBottom) || 0, Math.min(issue.radius, box.height / 2)) + 'px', 'important');
    const inset = css.boxSizing === 'border-box' ? 0 : ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, key) => n + (parseFloat(css[key]) || 0), 0);
    card.style.setProperty('min-height', Math.max(parseFloat(css.minHeight) || 0, box.height - inset) + 'px', 'important');
    card.style.setProperty('height', 'auto', 'important');
    card.style.setProperty('max-height', 'none', 'important');
  }
}
