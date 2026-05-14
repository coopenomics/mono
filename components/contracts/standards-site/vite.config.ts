import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  // При dev-сервере — корень; при build-е сайт публикуется как
  // поддиректория /standards/ на docs.coopenomics.world.
  base: command === 'build' ? '/standards/' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
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
