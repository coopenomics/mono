/**
 * Окно перечитывания списка с подгрузкой «ещё»: пайщик мог дочитать до
 * N-й страницы, и живое обновление должно освежить все видимые строки одним
 * запросом, на своих местах, а не только первую страницу. Сервер отдаёт не
 * больше тысячи строк за раз — дальше окно не растёт.
 */
const MAX_WINDOW = 1000;

export interface LiveWindow {
  /** Запрос окна: всегда с первой страницы. */
  options: { page: 1; limit: number };
  /** Сколько страниц размера `pageSize` уместилось в окно — для «загрузить ещё». */
  pages: number;
}

export function liveWindow(loadedPages: number | undefined, pageSize: number): LiveWindow {
  const pages = Math.max(1, Math.min(loadedPages ?? 1, Math.floor(MAX_WINDOW / pageSize)));
  return { options: { page: 1, limit: pages * pageSize }, pages };
}
