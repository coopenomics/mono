import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index', 'src/core-ports/index', 'src/cross-plugin-ports/index'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
  },
});
