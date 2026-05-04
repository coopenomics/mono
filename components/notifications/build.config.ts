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
})