import { defineBuildConfig } from 'unbuild'

// Один dual-выход (ESM .mjs + CJS .cjs + .d.ts) обслуживает все три target'а:
// браузер и desktop-runtime берут import→.mjs, Node — require→.cjs (exports-map).
export default defineBuildConfig({
  entries: ['src/index'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
  },
})
