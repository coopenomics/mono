/**
 * Минимальный контракт логгера, которым пользуется каркас синхронизации.
 *
 * Зачем отдельный тип, а не порт из `@coopenomics/innercoop`: пакеты каркаса и
 * контрактов ортогональны и не зависят друг от друга (INV-007). Связывать их
 * ради пяти методов нельзя, а дублировать порт — значит завести второе имя
 * для одной сущности.
 *
 * Поэтому здесь объявлена именно та часть, которую вызывает каркас, и опора
 * идёт на структурную типизацию: `WinstonLoggerService` ядра подходит под этот
 * контракт как есть, поэтому наследники передают его в `super()` без правок,
 * и `ILoggerPort` из innercoop подойдёт так же, когда появится.
 */
export interface ISyncLogger {
  /** Пометить, от чьего имени идут записи (обычно имя класса-наследника). */
  setContext(context: string): void;
  log(message: any, ...optionalParams: any[]): void;
  debug(message: any, ...optionalParams: any[]): void;
  warn(message: any, ...optionalParams: any[]): void;
  error(message: any, ...optionalParams: any[]): void;
}
