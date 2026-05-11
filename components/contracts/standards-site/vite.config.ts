import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const cppDir = path.resolve(rootDir, '..', 'cpp');

// YAML-стандарты лежат вне vite root (../cpp/**/*.standard.yaml). Vite по
// умолчанию не watch-ит файлы вне корня, поэтому HMR на правки YAML не
// срабатывает. Подключаем cpp/ к watcher и при изменении любого .standard.yaml
// инвалидируем loader.ts — glob пересчитается и страница обновится.
function watchCppStandardsPlugin(): Plugin {
  const yamlPattern = /\.standard\.yaml$/;
  return {
    name: 'watch-cpp-standards',
    configureServer(server) {
      server.watcher.add(cppDir);
      server.watcher.on('change', (file) => {
        if (!yamlPattern.test(file)) return;
        const loader = server.moduleGraph.getModuleById(
          path.resolve(rootDir, 'src/data/loader.ts'),
        );
        if (loader) server.moduleGraph.invalidateModule(loader);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // При dev-сервере — корень; при build-е сайт публикуется как
  // поддиректория /standards/ на docs.coopenomics.world.
  base: command === 'build' ? '/standards/' : '/',
  plugins: [vue(), watchCppStandardsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  // cooptypes — workspace-пакет (~2 МБ ESM-бандла), vite по умолчанию
  // workspace-deps не пре-бандлит и отдаёт через @fs трансформ-конвейер,
  // что в dev по сети растягивает chunk до 10 МБ и валит lazy-import
  // ProcessPage.vue. Принудительный optimizeDeps.include даёт нормальный
  // pre-bundled chunk, как для vue/vue-router.
  optimizeDeps: {
    include: ['cooptypes'],
  },
  server: {
    host: true,                // слушать 0.0.0.0 — доступ по IP из сети
    port: 5173,
    strictPort: false,
    allowedHosts: true,        // принимать любой Host-заголовок (IP / домен / прокси)
    // Позволяем vite вытягивать YAML-файлы из ../cpp/** (за пределами root проекта).
    fs: {
      allow: [rootDir, path.resolve(rootDir, '..', 'cpp')],
    },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
}));
