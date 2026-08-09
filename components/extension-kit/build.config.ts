import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    // BaseExtensionModule помечен @Injectable(). Без experimentalDecorators esbuild
    // принимает декоратор за stage-3 и падает на трансформе под es2020.
    // Метаданные не нужны: у базового класса нет параметров конструктора,
    // а конкретные <X>Extension компилируются в контроллере обычным tsc.
    esbuild: {
      target: 'es2022',
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    },
  },
});
