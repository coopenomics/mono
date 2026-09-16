import { boot } from 'quasar/wrappers';

/**
 * Правки долетают до открытой страницы, а не «после ручного F5».
 *
 * Vite обновляет модули на лету, но два случая оставляют вкладку на старом
 * коде молча, и со стороны это выглядит как «изменения не применились»
 * (14.09.2026 — полтора часа разбора):
 *
 *  1. Vue не смог подменить компонент на лету и пишет в консоль «Full reload
 *     required». Перезагружать при этом он никого не просит — просто с этого
 *     момента страница живёт прежней сборкой.
 *  2. Dev-сервер перезапустили. Канал обновлений рвётся, клиент Vite молча
 *     переподключается к уже другому серверу, а собранный до перезапуска код
 *     остаётся в памяти вкладки.
 *
 * В сборке для боевого контура `import.meta.hot` не существует, и файл не
 * делает ничего.
 */
export default boot(() => {
  const hot = import.meta.hot;
  if (!hot) return;

  // Случай 1: ловим само предупреждение — своего события у Vue на это нет.
  const warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    warn(...args);
    if (typeof args[0] === 'string' && args[0].includes('Full reload required')) {
      window.location.reload();
    }
  };

  // Случай 2: перезагружаемся не на обрыве (сервер может просто моргнуть), а
  // когда канал ВОССТАНОВИЛСЯ: к этому моменту на той стороне уже новый код.
  let wasDisconnected = false;
  hot.on('vite:ws:disconnect', () => {
    wasDisconnected = true;
  });
  hot.on('vite:ws:connect', () => {
    if (!wasDisconnected) return;
    wasDisconnected = false;
    window.location.reload();
  });
});
