/** Resource limits shared by GenUI repair, validation, and rendering. */
export const GENUI_LIMITS = {
  /** Maximum nesting depth of the component tree. */
  maxDepth: 8,
  /** Maximum total nodes across the whole spec. */
  maxNodes: 200,
  /** Maximum length of any plain string field. */
  maxString: 2000,
  /** Maximum length of a `code` body. */
  maxCode: 12_000,
  /** Maximum length of a mermaid source. */
  maxMermaid: 8000,
  /** Maximum `grid` columns. */
  maxGridCols: 12,
  /** Maximum `tabs` count. */
  maxTabs: 12,
  /** Maximum `accordion` items. */
  maxAccordionItems: 24,
  /** Maximum `list` items. */
  maxListItems: 50,
  /** Maximum `select`/`radio` options. */
  maxOptions: 50,
  /** Maximum `table` rows / columns. */
  maxTableRows: 50,
  maxTableCols: 12,
  /** Maximum `chart` data points per series. */
  maxChartPoints: 60,
  /** Maximum `plot` series and per-series parameters. */
  maxPlotSeries: 8,
  maxPlotParams: 6,
  /** Maximum `scene3d` meshes. */
  maxMeshes: 5,
  /** Maximum `quiz` options. */
  maxQuizOptions: 8,
  /** Maximum `steps` / `timeline` / `breadcrumb` / `keyvalue` entries. */
  maxSteps: 24,
  maxTimelineItems: 24,
  maxBreadcrumbItems: 12,
  maxKeyValuePairs: 24,
  /** Maximum `file-tree` nesting. */
  maxTreeDepth: 6,
  /** Maximum `diagram` nodes / edges / zones / focal accents. */
  maxDiagramNodes: 9,
  maxDiagramEdges: 12,
  maxDiagramZones: 3,
  maxDiagramFocal: 2,
  maxDiagramLabel: 14,
  /** Maximum depth of an `echart` option object. */
  maxEChartOptionDepth: 10,
  /** Maximum length of any single array inside an `echart` option. */
  maxEChartArrayLen: 500,
  /** Maximum entries traversed while sanitizing an `echart` option. */
  maxEChartOptionNodes: 2000,
} as const
