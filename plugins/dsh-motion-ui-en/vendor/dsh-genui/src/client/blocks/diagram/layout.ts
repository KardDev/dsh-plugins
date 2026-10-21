/**
 * Editorial diagram layout: resolves a `diagram` spec into positioned boxes
 * and routed edges. Two layout modes mirror diagram-design's grammar:
 *
 *  - Coordinate kinds (architecture, it-state, high-level, process,
 *    medallion, data-flow, dp-integration): the spec carries x/y/w/h per
 *    node; this module passes them through (4px-grid already enforced by the
 *    guard) and routes edges.
 *  - Rule kinds (flowchart, sequence, state, er, timeline, swimlane,
 *    quadrant, radar, loop, nested, tree, org-chart, layers, venn, pyramid,
 *    bar, line, gantt, scatter, dp-security-matrix): the spec carries data
 *    only; this module lays the nodes out on the editorial grid.
 *
 * The output is a plain layout object consumed by the SVG renderer — no
 * React, no DOM, fully unit-testable.
 * @module @changfenhuang/dsh-genui/client/blocks/diagram/layout
 */
import type { GenuiDiagram, GenuiDiagramEdge, GenuiDiagramKind, GenuiDiagramNode } from '../../spec.ts'
import { Box } from './geometry.ts'

export interface LayoutNode {
  node: GenuiDiagramNode
  box: Box
}

export interface LayoutEdge {
  edge: GenuiDiagramEdge
  /** Resolved box references for routing. */
  fromId: string
  toId: string
}

export interface DiagramLayout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  /** Canvas size (width/height). */
  width: number
  height: number
}

/** Coordinate-mode kinds: nodes carry explicit positions. */
const COORDINATE_KINDS: readonly GenuiDiagramKind[] = [
  'architecture', 'it-state', 'high-level', 'process', 'medallion', 'data-flow', 'dp-integration',
]

const GAP = 32 // editorial gap between nodes
const NODE_W = 128
const NODE_H = 64
const MARGIN = 40

function isCoord(kind: GenuiDiagramKind): boolean {
  return COORDINATE_KINDS.includes(kind)
}

/** Default box for a node without coordinates. */
function defaultBox(i: number, cols: number): Box {
  const col = i % cols
  const row = Math.floor(i / cols)
  return {
    x: MARGIN + col * (NODE_W + GAP),
    y: MARGIN + row * (NODE_H + GAP),
    w: NODE_W,
    h: NODE_H,
  }
}

/** Simple top-down flow layout: nodes in a column, one per row. */
function columnLayout(nodes: GenuiDiagramNode[]): LayoutNode[] {
  return nodes.map((node, i) => ({
    node,
    box: { x: MARGIN, y: MARGIN + i * (NODE_H + GAP), w: NODE_W, h: NODE_H },
  }))
}

/** Simple left-right flow layout: nodes in a row. */
function rowLayout(nodes: GenuiDiagramNode[]): LayoutNode[] {
  return nodes.map((node, i) => ({
    node,
    box: { x: MARGIN + i * (NODE_W + GAP), y: MARGIN, w: NODE_W, h: NODE_H },
  }))
}

/** Layered horizontal layout (layers, pyramid, gantt phases): stacked rows. */
function layerLayout(nodes: GenuiDiagramNode[], perRow = 3): LayoutNode[] {
  return nodes.map((node, i) => {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    return {
      node,
      box: {
        x: MARGIN + col * (NODE_W + GAP),
        y: MARGIN + row * (NODE_H + GAP),
        w: NODE_W,
        h: NODE_H,
      },
    }
  })
}

/** Tree layout: level = depth, children fan out horizontally under the parent. */
function treeLayout(nodes: GenuiDiagramNode[], parentOf: (id: string) => string | undefined): LayoutNode[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const childrenOf = new Map<string, string[]>()
  const roots: string[] = []
  for (const n of nodes) {
    const p = parentOf(n.id)
    if (p === undefined || !byId.has(p)) {
      roots.push(n.id)
    } else {
      const list = childrenOf.get(p) ?? []
      list.push(n.id)
      childrenOf.set(p, list)
    }
  }
  const placed = new Map<string, Box>()
  const depthOf = new Map<string, number>()

  // measure: leaf width = 1; parent width = sum of children widths.
  const measure = (id: string, depth: number): number => {
    depthOf.set(id, depth)
    const kids = childrenOf.get(id) ?? []
    if (kids.length === 0) return 1
    return kids.reduce((sum, k) => sum + measure(k, depth + 1), 0)
  }

  // assign: place children left→right, then center the parent above them.
  const assign = (id: string, left: number): number => {
    const depth = depthOf.get(id) ?? 0
    const kids = childrenOf.get(id) ?? []
    const w = NODE_W
    let cursor = left
    if (kids.length === 0) {
      placed.set(id, { x: left, y: MARGIN + depth * (NODE_H + GAP * 1.5), w, h: NODE_H })
      return left + w
    }
    for (const k of kids) cursor = assign(k, cursor)
    const first = placed.get(kids[0]!)!
    const last = placed.get(kids[kids.length - 1]!)!
    const cx = (first.x + last.x + last.w) / 2 - w / 2
    placed.set(id, { x: Math.max(left, cx), y: MARGIN + depth * (NODE_H + GAP * 1.5), w, h: NODE_H })
    return cursor
  }

  let left = MARGIN
  for (const r of roots) {
    left = assign(r, left) + GAP
  }
  return nodes.map(n => ({ node: n, box: placed.get(n.id) ?? { x: MARGIN, y: MARGIN, w: NODE_W, h: NODE_H } }))
}

/**
 * Resolve a diagram spec into a positioned layout. `parentOf` lets tree-like
 * kinds pass their hierarchy; other rule kinds use a generic grid.
 */
export function resolveLayout(
  diagram: GenuiDiagram,
  parentOf?: (id: string) => string | undefined,
): DiagramLayout {
  const nodes = diagram.nodes
  const edges = diagram.edges ?? []

  let placed: LayoutNode[]
  if (isCoord(diagram.kind)) {
    placed = nodes.map((node, i) => ({
      node,
      box: {
        x: node.x ?? MARGIN + (i % 3) * (NODE_W + GAP),
        y: node.y ?? MARGIN + Math.floor(i / 3) * (NODE_H + GAP),
        w: node.w ?? NODE_W,
        h: node.h ?? NODE_H,
      },
    }))
  } else if (diagram.kind === 'tree' || diagram.kind === 'org-chart' || diagram.kind === 'nested') {
    placed = treeLayout(nodes, parentOf ?? (() => undefined))
  } else if (diagram.kind === 'layers' || diagram.kind === 'pyramid' || diagram.kind === 'gantt') {
    placed = layerLayout(nodes)
  } else if (diagram.kind === 'flowchart' || diagram.kind === 'process' || diagram.kind === 'sequence') {
    // Directed flows read top-down.
    placed = columnLayout(nodes)
  } else if (diagram.kind === 'timeline' || diagram.kind === 'line' || diagram.kind === 'scatter' || diagram.kind === 'bar') {
    placed = rowLayout(nodes)
  } else {
    placed = nodes.map((node, i) => ({ node, box: defaultBox(i, 3) }))
  }

  // Canvas bounds.
  let width = 0
  let height = 0
  for (const l of placed) {
    width = Math.max(width, l.box.x + l.box.w)
    height = Math.max(height, l.box.y + l.box.h)
  }
  width = Math.max(320, Math.ceil((width + MARGIN) / 4) * 4)
  // Hug the content: the old 200px floor plus the legend strip made a 4-node
  // single row render inside a canvas twice its needed height, and the SVG
  // scales to the container width, so the empty band was amplified on screen.
  height = Math.max(96, Math.ceil((height + MARGIN) / 4) * 4)

  const edgesOut: LayoutEdge[] = edges.map(e => ({ edge: e, fromId: e.from, toId: e.to }))

  return { nodes: placed, edges: edgesOut, width, height }
}
