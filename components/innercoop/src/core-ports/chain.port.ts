/**
 * Проводка действий в цепь и чтение её таблиц.
 *
 * Расширение подаёт в цепь свои действия и иногда читает таблицу целиком —
 * там, где состояние ещё не разложено по базе. Ключ, узел и сборка транзакции
 * остаются в ядре. Раньше расширение инжектило `BlockchainService` по пути
 * `~/infrastructure/blockchain`, которого за пределами монолита нет.
 *
 * Чтение таблиц — не замена базе. Штатный путь чтения — репозиторий, куда
 * состояние попадает синхронизацией; таблица цепи нужна там, где записи в базе
 * ещё нет или она заведомо отстаёт.
 */

/**
 * Действие цепи: контракт, имя, полномочия и полезная нагрузка.
 *
 * Нагрузка не описана: её форма задаётся ABI контракта и меняется вместе с
 * ним. Проверить её здесь нельзя — это сделает узел при проводке.
 */
export interface InnerChainAction {
  account: string;
  name: string;
  authorization: Array<{ actor: string; permission: string }>;
  data: Record<string, any>;
}

/**
 * Итог проводки.
 *
 * Состав не описан: его задаёт SDK узла и меняет от версии к версии. Отсюда
 * читают идентификатор транзакции (`response.transaction_id` либо
 * `resolved.transaction.id`) и номер блока применения — последний доставайте
 * через `getAppliedBlockNum` каркаса, а не руками: в подписанной транзакции
 * лежит похожее, но другое число.
 */
export interface InnerTransactResult {
  response?: Record<string, any>;
  resolved?: Record<string, any>;
  [key: string]: any;
}

export interface IChainPort {
  /**
   * Задать, от чьего имени подписывать последующие действия.
   *
   * Ключ расширение получает через `IVaultPort` и обязано вызвать это перед
   * проводкой: без подписанта транзакция не соберётся.
   */
  initialize(username: string, wif: string): void;

  /**
   * Провести действие или пачку действий одной транзакцией. Пачка проходит
   * целиком либо не проходит вовсе — узел не применяет её частями.
   */
  transact(action: InnerChainAction | InnerChainAction[], broadcast?: boolean): Promise<InnerTransactResult>;

  /** Прочитать таблицу контракта целиком в пределах области видимости. */
  getAllRows<T = any>(code: string, scope: string, tableName: string): Promise<T[]>;

  /**
   * Прочитать одну строку таблицы по ключу. `null` — строки нет.
   *
   * Ключ описан широко (`unknown`), потому что цепь принимает и имя, и число, и
   * контрольную сумму — их представление задаёт SDK узла, а контракт от него не
   * зависит. Приведение делает адаптер ядра.
   */
  getSingleRow<T = any>(
    code: string,
    scope: string,
    tableName: string,
    primaryKey: unknown,
    indexPosition?: string,
    keyType?: string
  ): Promise<T | null>;
}

export const CHAIN_PORT = Symbol.for('Innercoop.CorePort.Chain');
