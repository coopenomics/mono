/**
 * Журналирование контура кооператива.
 *
 * Расширение не должно знать, чем именно пишется лог (сегодня Winston, завтра
 * Pino или OpenTelemetry) и где лежит его конфигурация. Оно берёт токен и зовёт
 * шесть методов; замена реализации — правка одного адаптера в ядре.
 *
 * Контракт снят с фактического потребления в расширениях, а не придуман:
 * `warn` 250 вызовов, `log` 249, `error` 180, `debug` 158, `info` 90,
 * `setContext` 84. `verbose` в расширениях не зовут ни разу, поэтому в порт он
 * не вынесен — реализация вправе иметь методы сверх контракта.
 */

/**
 * Дополнительные данные строки лога. Строка попадёт в поле `trace`, `Error` —
 * разложится на `errorMessage`/`errorStack`/`errorName`, объект вольётся в
 * запись как есть.
 */
export type InnerLogMeta = string | Error | Record<string, any>;

export interface ILoggerPort {
  /**
   * Пометить, от чьего имени идут записи (обычно имя класса-потребителя).
   *
   * Вызов **мутирует** логгер, поэтому провайдер обязан быть транзиентным:
   * на синглтоне 106 потребителей затирали бы контекст друг другу, и строки
   * приписывались бы чужим классам. См. регистрацию в `InnercoopBridgeModule`.
   */
  setContext(context: string): void;

  log(message: string, metaOrError?: InnerLogMeta): void;
  info(message: string, metaOrError?: InnerLogMeta): void;
  warn(message: string, metaOrError?: InnerLogMeta): void;
  debug(message: string, metaOrError?: InnerLogMeta): void;

  /**
   * `errorOrTrace` принимает `Error` целиком — тогда стек разложится по полям
   * записи. Второй аргумент `meta` добавляет произвольные данные рядом.
   */
  error(message: string, errorOrTrace?: InnerLogMeta, meta?: string | Record<string, any>): void;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────
/**
 * Журнал контура кооператива. Провайдер — ядро.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const LOGGER_PORT = Symbol.for('Innercoop.CorePort.Logger');
