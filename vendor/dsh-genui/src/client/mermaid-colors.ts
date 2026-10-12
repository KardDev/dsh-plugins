/** Resolve host CSS colors before passing them to Mermaid's limited parser. */
export function readMermaidThemeColor(name: string, fallback: string): string {
  if (typeof document === 'undefined' || document.body === null) return fallback
  const value = getComputedStyle(document.body).getPropertyValue(name).trim()
  if (value === '') return fallback

  // Computed custom properties still contain calc(), unlike computed color.
  // A real color property also resolves currentColor and inherited variables.
  const probe = document.createElement('span')
  probe.style.setProperty('color', value, 'important')
  if (probe.style.color === '') return fallback
  probe.style.setProperty('display', 'none', 'important')
  document.body.appendChild(probe)
  let color: string
  try {
    color = getComputedStyle(probe).color
  } finally {
    probe.remove()
  }
  if (/^rgba?\([\d.,\s]+\)$/i.test(color)) return color

  // Modern colors such as oklch() and color-mix() may remain in those formats
  // after style resolution. Canvas converts them to the sRGB Mermaid accepts.
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')
  if (context === null) return fallback
  context.fillStyle = '#010203'
  const initialFillStyle = context.fillStyle
  context.fillStyle = color
  if (context.fillStyle === initialFillStyle) return fallback
  try {
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return `rgba(${r}, ${g}, ${b}, ${a! / 255})`
  } catch {
    return fallback
  }
}
