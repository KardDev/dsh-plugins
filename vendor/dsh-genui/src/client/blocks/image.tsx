import { renderInline } from '../inline.ts'
import { useState, type ReactNode } from 'react'
import css from '../GenuiBlock.module.css'
import { useT } from '../i18n/index.ts'
import type { GenuiImage } from '../spec.ts'

/** Native image display; source safety is enforced by repairGenuiSpec/safeMediaSrc. */
export function ImageNode({ node }: { node: GenuiImage }): ReactNode {
  const t = useT()
  const [failed, setFailed] = useState(false)

  return (
    <figure className={css.media}>
      {node.alt !== undefined && <figcaption className={css.mediaLabel}>{renderInline(node.alt)}</figcaption>}
      {failed
        ? <div className={css.mediaError} role="alert">{t('block.imageError')}</div>
        : <img
            className={css.mediaPlayer}
            src={node.src}
            alt={node.alt ?? t('block.image')}
            loading="lazy"
            decoding="async"
            style={{ maxHeight: 'min(70vh, 720px)', objectFit: 'contain' }}
            onError={() => setFailed(true)}
          />}
    </figure>
  )
}
