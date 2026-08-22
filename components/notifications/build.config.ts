import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index'],
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