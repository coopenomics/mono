import { defineBuildConfig } from 'unbuild'

// Bundle workspace-deps (cooptypes, @coopenomics/factory) внутрь
// dist/index.cjs, чтобы в docker-образе не нужно было их пробрасывать
// через workspace-context. NPM-deps оставляем external — nativе
// binaries (cpu-features через dockerode→ssh2) не bundling-friendly,
// плюс tree-shake даёт меньшие финальные node_modules.
//
// unbuild 2 имеет особенность: pkg.dependencies авто-добавляются в
// externals ДО hooks. Чтобы override — переопределяем external через
// rollup:options. Возвращаем false → не external → inline. Возвращаем
// undefined → unbuild решает по своим правилам (а он по умолчанию
// делает npm-deps external).
export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  declaration: true,
  clean: true,
  // Inline workspace-deps тянет в граф транзитивные npm-deps factory'а
  // (mongodb, handlebars, ajv, ...). unbuild на них warning'ит как
  // "implicit external" — они корректно остаются external (мы их
  // мерджим в boot/package.json в Dockerfile), но warning по умолчанию
  // делает failOnWarn:true → нужно явно отключить.
  failOnWarn: false,
  rollup: {
    emitCJS: true,
  },
  hooks: {
    'rollup:options'(_ctx, options) {
      const prev = options.external
      options.external = (id: string, importer?: string, isResolved?: boolean) => {
        if (id === 'cooptypes' || id.startsWith('@coopenomics/factory'))
          return false
        if (typeof prev === 'function')
          return (prev as any)(id, importer, isResolved)
        return undefined
      }
    },
  },
})
