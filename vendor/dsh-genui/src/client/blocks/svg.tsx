import { useMemo, useState } from 'react'
import type { GenuiSvg } from '../spec.ts'
import { renderInline } from '../inline.ts'
import { t } from '../i18n/index.ts'
import css from '../GenuiBlock.module.css'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/** Parse `code` as an XML document; its root element when the body is a bare `<svg>`. */
function parseSvgRoot(code: string): Element | null {
  const doc = new DOMParser().parseFromString(code, 'image/svg+xml')
  const root = doc.documentElement
  if (doc.doctype !== null || doc.querySelector('parsererror') !== null || root.localName !== 'svg') return null
  return root
}

function imageSource(code: string): string | null {
  try {
    const root = parseSvgRoot(code)
    if (root === null) return null
    if (root.namespaceURI !== SVG_NAMESPACE) {
      // An explicitly foreign namespace on the root stays rejected; only the
      // un-namespaced HTML-style form gets healed.
      if (root.namespaceURI !== null) return null
      // XML parsing performs no default-namespace inference: an HTML-style
      // <svg> without xmlns — the most common shape models emit, since HTML
      // infers the namespace — is well-formed but un-namespaced. Declare the
      // namespace in the source and re-validate the patched text instead of
      // rejecting the markup outright (issue #185). A mis-landed injection
      // only fails the re-parse below; it can never render different markup.
      const patched = code.replace(/<svg(?=[\s/>])/, `<svg xmlns="${SVG_NAMESPACE}"`)
      const reparsed = parseSvgRoot(patched)
      if (reparsed === null || reparsed.namespaceURI !== SVG_NAMESPACE) return null
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(patched)}`
    }
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(code)}`
  } catch {
    return null
  }
}

export function SvgNode({ node }: { node: GenuiSvg }) {
  const src = useMemo(() => imageSource(node.code), [node.code])
  const [failedSource, setFailedSource] = useState<string | null>(null)
  return (
    <div data-genui-svg>
      {node.title !== undefined && <div className={css.echartTitle}>{renderInline(node.title)}</div>}
      {src === null || failedSource === src ? (
        <div>
          <div role="status">{t('block.svgError')}</div>
          <pre style={{ overflow: 'auto', maxHeight: 400 }}><code>{node.code}</code></pre>
        </div>
      ) : (
        // SVG stays in image mode: never inject model markup into the host DOM
        // or expose this URL through a link, iframe, object, or embed.
        <img
          key={src}
          src={src}
          alt={node.title ?? t('block.svgLabel')}
          style={{ display: 'block', width: '100%', height: node.height ?? 'auto', maxHeight: 800, objectFit: 'contain' }}
          onError={() => { setFailedSource(src) }}
        />
      )}
    </div>
  )
}
