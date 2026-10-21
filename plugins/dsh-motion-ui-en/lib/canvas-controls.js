// Serialized into the opaque frame. Only repairs unreadable timeline chrome;
// the authored stage and ordinary interactive documents retain their styling.
export function createTimelineControlRepair() {
  const originals = new WeakMap();
  const rgb = text => {
    const match = text.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    const values = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return values.length >= 3 ? [...values.slice(0, 3), values[3] ?? 1] : null;
  };
  const over = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));
  const luminance = c => c.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  return () => {
    const stage = document.getElementById('stage'), root = document.getElementById('canvas');
    if (!stage || !root) return;
    for (const el of root.querySelectorAll('button,output,select,input:not([type=range]):not([type=checkbox]):not([type=radio])')) {
      if (stage.contains(el)) continue;
      let saved = originals.get(el);
      if (saved) for (const [key, value, priority] of saved) value ? el.style.setProperty(key, value, priority) : el.style.removeProperty(key);
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const layers = []; let uncertain = false;
      for (let parent = el; parent; parent = parent.parentElement) {
        const backgroundStyle = getComputedStyle(parent);
        // A gradient/image cannot be reduced to one reliable backdrop color.
        if (backgroundStyle.backgroundImage !== 'none') { uncertain = true; break; }
        const color = rgb(backgroundStyle.backgroundColor);
        if (color) layers.push(color);
        if (color?.[3] === 1) break;
      }
      if (uncertain) continue;
      const background = layers.reverse().reduce((color, layer) => over(layer, color), [255, 255, 255]);
      const foreground = rgb(style.color);
      if (!foreground || contrast(over(foreground, background), background) >= 4.5) continue;
      if (!saved) {
        saved = ['color', 'border-color'].map(key => [key, el.style.getPropertyValue(key), el.style.getPropertyPriority(key)]);
        originals.set(el, saved);
      }
      const light = [248, 250, 252], dark = [17, 24, 39];
      el.style.setProperty('color', contrast(light, background) > contrast(dark, background) ? '#f8fafc' : '#111827', 'important');
      const border = rgb(style.borderTopColor);
      if (parseFloat(style.borderTopWidth) > 0 && border && contrast(over(border, background), background) < 1.5) el.style.setProperty('border-color', '#64748b', 'important');
    }
  };
}

export function canvasContentHeight(root) {
  const body = getComputedStyle(document.body);
  // getBoundingClientRect().height alone excludes author-defined body padding.
  // Do not use scrollHeight: it is floored by the old iframe viewport and cannot shrink.
  return Math.ceil(root.getBoundingClientRect().bottom + window.scrollY + (parseFloat(body.paddingBottom) || 0) + (parseFloat(body.marginBottom) || 0));
}
