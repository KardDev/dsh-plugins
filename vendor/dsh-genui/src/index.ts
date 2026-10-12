/**
 * Bundle source entry (plugin_check tool-bundle contract): the node-half
 * surface the host loader resolves through `package.json#main`.
 *
 */
// Load the owner package's client augmentation before the plugin re-export so
// TypeScript resolves client context members consistently from this root entry.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
export * from './plugin/index'
