import { useSSRContext } from 'vue';

/**
 * Код ответа документа при серверном рендере. Страница отказа обязана уходить
 * с 403, страница входа — с 401: так браузер, кэш и мониторинг видят честный
 * статус, а не «200 с картинкой отказа». Вызывать только из `setup` страницы.
 * На клиенте ничего не делает.
 */
export function setSsrStatus(code: number): void {
  if (!process.env.SERVER) return;
  const ctx = useSSRContext<{ res?: { statusCode?: number } }>();
  if (ctx?.res) ctx.res.statusCode = code;
}
