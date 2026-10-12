/**
 * /panel slash command + the default panel spec.
 *
 * The session panel dock is an always-present seat, but it only becomes
 * visible once a spec has been published — both existing publish paths
 * (render_ui tool result, panel:true fence) are model-driven. The /panel
 * command gives a deterministic, client-side entry point:
 * - `/panel` — publishes the default spec and requests the dock to expand
 *   instantly, with zero model round-trip;
 * - `/panel clear` (off/close) — empties the panel so the dock retracts;
 * - `/panel <instruction>` — shows the default spec for immediate feedback,
 *   then relays the instruction to the model, which replaces the panel with
 *   content tailored to the request (panel:true fence).
 * Panel updates afterwards still flow through the model (say "update the
 * panel", or re-run render_ui) or through another /panel.
 */
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GenuiSpec } from './spec.ts'
import { requestPanelExpand, setLocalPanel } from './panel-store.ts'
import { t } from './i18n/index.ts'

/**
 * Default panel content published by `/panel`: the component overview.
 *
 * Built PER CALL so the panel opens in whatever language is active now,
 * rather than the one that happened to be active at module load.
 */
export function defaultPanelSpec(): GenuiSpec {
  return {
    title: t('panel.title.default'),
    items: [
      { type: 'text', size: 'h3', content: t('panel.default.heading') },
      { type: 'text', size: 'muted', content: t('panel.default.subtitle') },
      {
        type: 'grid', cols: 4, items: [
          { type: 'stat', label: t('panel.default.stat.components'), value: '38' },
          { type: 'stat', label: t('panel.default.stat.single'), value: '12' },
          { type: 'stat', label: t('panel.default.stat.composite'), value: '8' },
          { type: 'stat', label: t('panel.default.stat.advanced'), value: '18' },
        ],
      },
      {
        type: 'list', items: [
          { title: t('panel.default.group.single'), desc: 'text button input select checkbox link badge stat progress divider avatar spacer' },
          { title: t('panel.default.group.composite'), desc: 'row col grid card list table chart tabs' },
          { title: t('panel.default.group.data'), desc: 'plot callout steps keyvalue diff json code' },
          { title: t('panel.default.group.interactive'), desc: 'radio switch textarea accordion copy' },
          { title: t('panel.default.group.advanced'), desc: 'mermaid scene3d timeline file-tree breadcrumb' },
          { title: t('panel.default.group.teaching'), desc: 'quiz' },
        ],
      },
      { type: 'callout', tone: 'info', title: t('panel.default.callout.title'), content: t('panel.default.callout.body') },
    ],
  }
}

/** Shared command application: apply the local override (default panel +
 * expand, or clear). The override is the fold base and shields against every
 * replay at/below the highest message seq seen so far; the next later real
 * tool/fence operation replaces or merges into it as usual. */
function applyPanelCommand(sessionId: string, args: string): void {
  const cmd = args.trim().toLowerCase()
  if (cmd === 'clear' || cmd === 'off' || cmd === 'close') {
    setLocalPanel(sessionId, null)
    return
  }
  setLocalPanel(sessionId, defaultPanelSpec())
  requestPanelExpand(sessionId)
}

/**
 * Build the command claim for one session (span CAS is handled by the input).
 * `sendInstruction` relays a /panel instruction to the model when the user
 * typed more than a bare command — otherwise the instruction would be
 * swallowed (the draft is cleared on submit) and the panel would never leave
 * its default content.
 */
function panelClaim(sessionId: SessionId, sendInstruction: (sessionId: SessionId, instruction: string) => void) {
  return {
    name: 'panel',
    token: '/panel',
    hint: t('panel.cmd.hint'),
    submit: async (args: string, _actx: ClientContext) => {
      const instruction = args.trim()
      if (instruction === '' ) {
        applyPanelCommand(sessionId, '')
      } else if (/^(clear|off|close)$/i.test(instruction)) {
        applyPanelCommand(sessionId, instruction)
      } else {
        // Instructed panel: show the default spec instantly for feedback,
        // then let the model replace it with the requested content.
        applyPanelCommand(sessionId, '')
        sendInstruction(sessionId, instruction)
      }
      // Success clears the draft without sending a message (the dock itself
      // is the feedback); no `text` so the input shows no notice either.
      return { kind: 'success' as const }
    },
  }
}

/**
 * The /panel source. Menu group `genui` under the '/' trigger; the panel
 * candidate claims the line so both the menu pick and a bare `/panel` enter
 * resolve to the same command. `matchEnter` is implemented so the command
 * works without opening the menu (leading-token adjudication), and it also
 * catches `/panel clear` style args.
 */
export function createPanelSlashSource(sendInstruction: (sessionId: SessionId, instruction: string) => void): InputTriggerSource {
  return {
    trigger: '/',
    name: 'genui',
    order: 60,
    candidates: async (_session, req) => {
      // Filter by query prefix: once the user types past "panel" the genui
      // group must disappear. Unfiltered candidates kept this group the only
      // ready non-empty group for unmatched queries, so the menu's default
      // highlight fell through to `panel` and Enter picked it instead of the
      // intended command/skill candidate.
      const query = req.query.toLowerCase()
      if (query !== '' && !'panel'.startsWith(query)) return []
      return [{
        name: 'panel',
        description: t('panel.cmd.description'),
        hint: '/panel',
      }]
    },
    onPick(pick) {
      return { claim: panelClaim(pick.session.sessionId, sendInstruction) }
    },
    matchEnter: async (session, line, _signal) => {
      if (!/^\/panel(?:\s|$)/.test(line.trim())) return undefined
      return { claim: panelClaim(session.sessionId, sendInstruction) }
    },
  }
}
