import { createRoot } from 'react-dom/client'
import { GenuiBlock } from '../GenuiBlock.tsx'
import { GenuiActionContext } from '../action-context.ts'
import { ErrorBoundary } from '../ErrorBoundary.tsx'
import { parseGenuiArtifact } from '../artifact/parse.ts'
import { setLocale } from '../i18n/runtime.ts'
import './katex-style.ts'
import './bootstrap-types.ts'

/** 挂载独立 artifact，并返回卸载该界面的函数。 */
function mount(root: HTMLElement, rawArtifact: unknown): () => void {
  const artifact = parseGenuiArtifact(rawArtifact)
  if (artifact === null) throw new Error('invalid GenUI artifact')
  setLocale(artifact.presentation.locale)
  document.body.toggleAttribute('data-ds-dark-theme', artifact.presentation.theme === 'dark')
  const reactRoot = createRoot(root)
  reactRoot.render(
    <GenuiActionContext.Provider value={undefined}>
      <ErrorBoundary label="GenUI">
        <GenuiBlock spec={artifact.spec} initialState={artifact.state} animateEntrance={false} />
      </ErrorBoundary>
    </GenuiActionContext.Provider>,
  )
  return () => reactRoot.unmount()
}

window.__GenuiStandalone__ = { mount }
