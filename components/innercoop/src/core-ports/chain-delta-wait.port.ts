/**
 * Ответ после факта из цепи. Мутация отправила транзакцию — и ждёт, пока
 * изменение её блока придёт от индексатора и ляжет в базу узла, а уже потом
 * отвечает свежими данными. Вместо выдуманной паузы «секунда-две» — реальная
 * задержка разбора блока; не пришло за отведённое время — ответ «ещё идёт»,
 * интерфейс догонит сам (ADR-009, DEC-T10 требования «Интеграция контроллера
 * с parser2»).
 */

/** Изменение строки таблицы контракта — как его отдаёт индексатор. */
export interface InnerChainDelta {
  code: string;
  scope: string;
  table: string;
  primary_key: string;
  block_num: number;
  /** false — строка удалена. */
  present: boolean;
  value?: Record<string, unknown>;
}

export interface InnerChainDeltaWaitQuery {
  /** Контракт, чью таблицу меняет транзакция. */
  code: string;
  /** Таблица; без поля — любая таблица контракта. */
  table?: string;
  /** Область (обычно coopname); без поля — любая. */
  scope?: string;
  /** Блок транзакции: изменения из более ранних блоков не считаются. */
  minBlockNum: number;
  /** Та ли это строка (по хэшу, пайщику и т. п.); без поля — любая подходящая. */
  match?: (delta: InnerChainDelta) => boolean;
  /** Сколько ждать, мс; без поля — значение узла по умолчанию. */
  timeoutMs?: number;
}

/** Ожидание одной таблицы после транзакции — блок берётся из самой транзакции. */
export type InnerChainTxWait = Omit<InnerChainDeltaWaitQuery, 'minBlockNum'>;

/**
 * Паттерн записи (ADR-009): отправили транзакцию — дождались, пока её
 * изменения придут из цепи и лягут в базу, — ответили из базы.
 *
 *   const tx = await this.chain.createProgramInvest(data);
 *   await this.chainWait.afterTransact(tx, [
 *     { code: 'ledger2', table: 'userwallets', scope: coopname, match: byUser(username) },
 *   ]);
 */
export interface IChainDeltaWaitPort {
  /**
   * Дождаться изменений транзакции в перечисленных таблицах. `true` — все
   * пришли и записаны; `false` — хоть одно не пришло в срок (ответ всё равно
   * можно отдавать: интерфейс догонит при следующем чтении).
   */
  afterTransact(transactResult: unknown, waits: InnerChainTxWait[]): Promise<boolean>;
  /** Номер блока транзакции из результата transact; 0 — не определить. */
  blockOf(transactResult: unknown): number;
  /**
   * Дождаться изменения, которое уже записано в базу узла (все слушатели
   * дельты отработали). `null` — не дождались за отведённое время.
   */
  waitForDelta(query: InnerChainDeltaWaitQuery): Promise<InnerChainDelta | null>;
}

export const CHAIN_DELTA_WAIT_PORT = Symbol.for('Innercoop.CorePort.ChainDeltaWait');
