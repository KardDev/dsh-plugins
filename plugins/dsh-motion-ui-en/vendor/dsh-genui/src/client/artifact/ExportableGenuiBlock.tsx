import { useCallback, useEffect, useRef, useState } from 'react'
import type { BlockInteractionState } from '../interaction-store.ts'
import { useT } from '../i18n/index.ts'
import { GenuiBlock } from '../GenuiBlock.tsx'
import type { GenuiBlockProps } from '../blocks/state.ts'
import { analyzeGenuiPortability } from './portability.ts'
import { createGenuiArtifact } from './create.ts'
import { downloadGenuiArtifactHtml, downloadGenuiArtifactJson } from './download.ts'
import { GenuiExportError } from './types.ts'
import css from './ArtifactExport.module.css'

interface ArtifactExportMenuProps {
  getArtifact: () => ReturnType<typeof createGenuiArtifact>
}

/** 提供 JSON 和 HTML 的本地化导出菜单。 */
function ArtifactExportMenu({ getArtifact }: ArtifactExportMenuProps) {
  const t = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const report = analyzeGenuiPortability(getArtifact().spec)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [open])

  /** 执行用户选择的下载并更新辅助说明。 */
  const exportAs = async (format: 'html' | 'json'): Promise<void> => {
    setOpen(false)
    setErrorMessage('')
    try {
      const artifact = getArtifact()
      if (format === 'html') await downloadGenuiArtifactHtml(artifact)
      else downloadGenuiArtifactJson(artifact)
    } catch (error) {
      if (error instanceof GenuiExportError) {
        if (error.code === 'unsupported-custom-component') {
          console.warn('[dsh-genui] standalone export rejected:', error.message)
          setErrorMessage(t('artifact.unsupportedCustom', { types: report.customTypes.join(', ') }))
        } else {
          console.warn('[dsh-genui] artifact export failed:', error.code, error.message)
          setErrorMessage(t('artifact.exportFailed'))
        }
      } else {
        console.warn('[dsh-genui] artifact export failed:', error instanceof Error ? error.message : 'unknown error')
        setErrorMessage(t('artifact.exportFailed'))
      }
    }
  }

  return (
    <div className={css.chrome} ref={rootRef} data-genui-export>
      {report.externalMedia.length > 0 && <span className={css.notice}>{t('artifact.externalMediaNotice')}</span>}
      {errorMessage !== '' && <span className={css.statusError} aria-live="polite">{errorMessage}</span>}
      <button type="button" className={css.trigger} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {t('artifact.export')}
      </button>
      {open && (
        <div className={css.menu} role="menu">
          <button type="button" role="menuitem" className={css.item} disabled={report.customTypes.length > 0} onClick={() => void exportAs('html')}>{t('artifact.exportHtml')}</button>
          {report.customTypes.length > 0 && <span className={css.menuNotice}>{t('artifact.unsupportedCustom', { types: report.customTypes.join(', ') })}</span>}
          <button type="button" role="menuitem" className={css.item} onClick={() => void exportAs('json')}>{t('artifact.exportJson')}</button>
        </div>
      )}
    </div>
  )
}

export interface ExportableGenuiBlockProps extends GenuiBlockProps {
  exportEnabled?: boolean
}

/** 在完成态 GenUI 外层显示 artifact 导出菜单。 */
export function ExportableGenuiBlock(props: ExportableGenuiBlockProps) {
  const stateRef = useRef<BlockInteractionState | undefined>(undefined)
  const captureState = useCallback((state: BlockInteractionState) => {
    stateRef.current = state
  }, [])
  const getArtifact = useCallback(() => createGenuiArtifact(props.spec, stateRef.current), [props.spec])
  const { exportEnabled = true, ...blockProps } = props
  return (
    <div data-genui-artifact>
      <GenuiBlock {...blockProps} onStateSnapshot={captureState} />
      {exportEnabled && <ArtifactExportMenu getArtifact={getArtifact} />}
    </div>
  )
}
