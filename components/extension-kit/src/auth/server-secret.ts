/**
 * Межсервисный обход авторизации по заголовку `server-secret`.
 *
 * Секрет держится модульным значением, а не инжектится через DI — ровно так же,
 * как сегодня guard'ы читают синглтон `config` контроллера. Поведение при переносе
 * в пакет не меняется, и guard'ы остаются пригодными к `@UseGuards(...)` без
 * регистрации дополнительного модуля в каждом месте применения.
 *
 * Хост (контроллер или субграф расширения) обязан вызвать `configureExtensionAuth`
 * на старте, до обработки первого запроса.
 */
import { timingSafeEqual } from 'node:crypto';

let serverSecret: string | undefined;

export interface ExtensionAuthOptions {
  /** Значение заголовка `server-secret`, дающего межсервисный доступ. */
  serverSecret: string;
}

export function configureExtensionAuth(options: ExtensionAuthOptions): void {
  serverSecret = options.serverSecret;
}

/**
 * Совпадает ли заголовок запроса с настроенным секретом.
 * Пока `configureExtensionAuth` не вызван, обхода нет — это безопасный дефолт:
 * забытая настройка приводит к отказу в доступе, а не к его выдаче.
 */
export function hasServerSecret(headers: Record<string, any> | undefined): boolean {
  if (!serverSecret) return false;
  const provided = headers?.['server-secret'];
  if (typeof provided !== 'string') return false;
  // Сравнение за постоянное время: обычное `===` выходит на первом несовпавшем
  // байте, и по времени ответа секрет подбирается посимвольно.
  const a = Buffer.from(provided);
  const b = Buffer.from(serverSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}
