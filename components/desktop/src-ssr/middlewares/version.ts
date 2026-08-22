import { ssrMiddleware } from 'quasar/wrappers';

/**
 * Self-report версии задеплоенной ноды.
 *
 * Источник истины «какая версия фронта задеплоена здесь» — сам SSR-сервер,
 * а не nginx-файл и не бэкенд. APP_VERSION запекается из package.json на этапе
 * build (quasar.config.cjs → build.env), поэтому отражает версию контейнера,
 * который сейчас обслуживает запрос. Клиент (с запечённой при сборке версией)
 * периодически опрашивает /version и при расхождении показывает тост.
 *
 * В blue-green после переключения апстрима опрос старого клиента попадает на
 * новую ноду → версия отличается → оповещение.
 *
 * В SPA этого middleware нет (ноды нет): запрос /version проваливается в
 * index.html, клиент видит не-JSON и молча пропускает — приложение не ломается.
 */
const VERSION = (process.env.APP_VERSION as string) || 'unknown';

export default ssrMiddleware(({ app }) => {
  app.get('/version', (_req, res) => {
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.send(JSON.stringify({ version: VERSION }));
  });
});
