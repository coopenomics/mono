import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index', 'src/sync/index'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    // BaseExtensionModule помечен @Injectable(). Без experimentalDecorators esbuild
    // принимает декоратор за stage-3 и падает на трансформе под es2020.
    //
    // `emitDecoratorMetadata` esbuild не поддерживает вовсе, поэтому в пакете
    // нельзя полагаться на вывод токена из типа: у всех колонок TypeORM и полей
    // GraphQL тип указан явно, а единственный конкретный @Injectable с
    // недекорированным параметром — EntityVersioningService — получил @Inject.
    // Наследники же компилируются в контроллере обычным tsc и метаданные имеют.
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
