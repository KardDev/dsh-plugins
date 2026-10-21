/**
 * TemplateDrawer — the GenUI template center (new-user onboarding).
 *
 * Browse by category → click a card → inline preview (the demo spec rendered
 * directly by GenuiBlock, dogfooding) + "try it" (insert into the composer) /
 * "copy instruction". The user sees the result first and only then decides to
 * send the instruction to the model — the genui capability manual.
 */
import { useMemo, useRef, useState } from 'react'
import { genuiTemplates, TEMPLATE_CATEGORIES, categoryLabelKey, type GenuiTemplate, type TemplateCategory } from './templates.ts'
import { useLocaleRevision, useT } from './i18n/index.ts'
import { GenuiBlock } from './GenuiBlock.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { panelStateKey } from './interaction-store.ts'
import { buildAchievementsSpec } from './achievements.ts'
import { getAchievementSnapshot, subscribeAchievements } from './achievement-store.ts'
import { useSyncExternalStore } from 'react'
import css from './TemplateDrawer.module.css'

export interface TemplateDrawerProps {
  /** Try it: insert the template instruction into the composer draft. */
  onUse: (instruction: string) => void
  /** Which drawer is open (template center / trophies), driven by the header. */
  tab: 'templates' | 'achievements'
}

/** Filter ids: `all` plus every template category. Labels are localized. */
const CATEGORIES = ['all', ...TEMPLATE_CATEGORIES] as const
type Category = TemplateCategory | 'all'

/** Copy to clipboard with a legacy fallback (like GenuiCopy). */
function copyText(text: string): Promise<void> {
  if (navigator.clipboard !== undefined) return navigator.clipboard.writeText(text)
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      resolve()
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

export function TemplateDrawer({ onUse, tab }: TemplateDrawerProps) {
  const t = useT()
  const localeRevision = useLocaleRevision()
  const [category, setCategory] = useState<Category>('all')
  const [selected, setSelected] = useState<GenuiTemplate | null>(null)
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  // Achievements tab: live state snapshot.
  const achievements = useSyncExternalStore(subscribeAchievements, () => getAchievementSnapshot())
  const achievementSpec = useMemo(
    () => buildAchievementsSpec(achievements.state, achievements.unlocked),
    [achievements, localeRevision],
  )

  // Rebuilt when the locale changes: `t` keeps a stable identity, so the
  // revision — not `t` — is what invalidates this memo.
  const items = useMemo(
    () => {
      const all = genuiTemplates()
      return category === 'all' ? [...all] : all.filter(tpl => tpl.category === category)
    },
    [category, localeRevision],
  )

  const copy = async (text: string): Promise<void> => {
    try {
      await copyText(text)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard denied: the instruction stays in the drawer; nothing else
      // to do — the use flow does not depend on it.
    }
  }

  return (
    <div className={css.wrap} data-genui-templates={tab === 'templates' ? undefined : 'achievements'}>
      {tab === 'achievements' ? (
        <div className={css.achievements} data-genui-achievements>
          <ErrorBoundary label={t('tpl.boundary.achievements')}>
            <GenuiBlock spec={achievementSpec} stateKey={panelStateKey('genui-achievements', JSON.stringify(achievementSpec))} />
          </ErrorBoundary>
        </div>
      ) : (
        <>
          <div className={css.cats} role="tablist" aria-label={t('tpl.categories.aria')}>
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                className={`${css.cat}${category === c ? ` ${css.catActive}` : ''}`}
                onClick={() => { setCategory(c); setSelected(null) }}
              >
                {t(categoryLabelKey(c))}
              </button>
            ))}
          </div>
          <div className={css.list}>
            {items.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                className={`${css.card}${selected?.id === tpl.id ? ` ${css.cardActive}` : ''}`}
                onClick={() => setSelected(prev => (prev?.id === tpl.id ? null : tpl))}
              >
                <span className={css.cardName}>{tpl.name}</span>
                <span className={css.cardMeta}>{t(categoryLabelKey(tpl.category))}</span>
                <span className={css.cardDesc}>{tpl.description}</span>
              </button>
            ))}
          </div>
          {selected !== null && (
            <div className={css.detail} data-genui-template-preview>
              <div className={css.toolbar}>
                <span className={css.toolbarTitle}>{selected.name}</span>
                <button type="button" className={css.try} onClick={() => onUse(selected.instruction)}>
                  {t('tpl.try')}
                </button>
                <button type="button" className={css.copy} onClick={() => void copy(selected.instruction)}>
                  {copied ? t('tpl.copied') : t('tpl.copy')}
                </button>
              </div>
              <div className={css.preview}>
                <ErrorBoundary label={t('tpl.boundary.preview')}>
                  <GenuiBlock spec={selected.demo} stateKey={panelStateKey('genui-tpl', selected.id)} />
                </ErrorBoundary>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
