import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    // Standalone CLI-runner для синхронизации Novu workflows.
    // Раньше был tsc-собранный `dist/sync/sync-runner.js` с
    // extension-less ESM-import'ами, запускавшийся только через
    // `tsx` (devDep). Через unbuild делаем bundle с резолвингом
    // импортов — запускается чистым `node` без devDeps.
    'src/sync/sync-runner',
  ],
  declaration: true,
  clean: false,
  failOnWarn: false,
  rollup: {
    emitCJS: true,
  },
  hooks: {
    'rollup:options'(_ctx, options) {
      const prev = options.external
      // chokidar тянет fsevents (.node) — Rollup не может их бандлить.
      // devDep остаётся runtime-зависимостью только для sync --dev.
      options.external = (id: string, importer?: string, isResolved?: boolean) => {
        if (id === 'chokidar' || id === 'fsevents')
          return true
        if (typeof prev === 'function')
          return (prev as (id: string, importer?: string, isResolved?: boolean) => boolean | undefined)(id, importer, isResolved)
        if (Array.isArray(prev))
          return prev.includes(id)
        return undefined
      }
    },
  },
})