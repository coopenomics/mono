/**
 * Контракт syncer'а, который умеет откатывать свои сущности при форке (ADR-005, Story 4.1).
 *
 * Реализуется один раз — в AbstractEntitySyncService, поэтому каждый наследник (capital,
 * agreements, wallet и пр.) получает поведение автоматически через `implements` родителя.
 *
 * ForkRegistryService собирает реализующих через DiscoveryService по symbol-маркеру
 * FORK_AWARE_MARKER на onApplicationBootstrap — без правок onModuleInit у наследников,
 * без instanceof-зависимости (Symbol на прототипе работает кросс-extension).
 *
 * ForkRegistryService обходит зарегистрированных syncer'ов **последовательно** (for-of await)
 * для каждой `handleFork(blockNum)`: re-throw любой ошибки останавливает дальнейший обход
 * и не даёт parser2 ACK'нуть форк-событие (повторная доставка пересыграет цепочку).
 */
export interface IForkAwareSyncer {
  /**
   * Откатить сущности этого syncer'а до состояния на блок forkBlockNum включительно.
   * При ошибке — обязан re-throw (silent catch ломает контракт sequential apply).
   *
   * Story 4.4: `forkEventId` (optional) — локально-вычисленный controller-формат
   * event_id (см. computeForkEventId), пробрасывается syncer'ом в архив инвалидированных
   * сущностей (invalidated_entities.fork_event_id) для группировки по форкам. Старые
   * вызовы без второго параметра остаются валидными — поле в архиве записывается NULL.
   */
  handleFork(forkBlockNum: number, forkEventId?: string | null): Promise<void>;

  /**
   * Опциональный приоритет для FK-зависимостей внутри одного контракта (меньше = раньше).
   * Если не задан — порядок берётся из обхода DiscoveryService (отражает DI-граф Nest).
   */
  readonly forkRollbackPriority?: number;
}

/**
 * Marker symbol для отделения форк-aware syncer'ов от прочих провайдеров при сканировании
 * DiscoveryService. Класс-родитель AbstractEntitySyncService выставляет marker = true на
 * своих экземплярах, поэтому все 20+ наследников автоматически попадают в обход без
 * правок их onModuleInit.
 */
export const FORK_AWARE_MARKER = Symbol.for('mono.controller.shared.sync.ForkAware');

/**
 * Type guard для проверки, что произвольный провайдер реализует IForkAwareSyncer.
 * Проверяет наличие symbol-маркера на инстансе и метода handleFork — duck typing
 * с защитой от ложных срабатываний.
 */
export function isForkAware(candidate: unknown): candidate is IForkAwareSyncer {
  if (candidate == null) return false;
  const obj = candidate as Record<PropertyKey, unknown>;
  return obj[FORK_AWARE_MARKER] === true && typeof obj.handleFork === 'function';
}
