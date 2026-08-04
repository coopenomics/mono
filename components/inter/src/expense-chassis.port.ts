/**
 * Шасси расходов (контракт `expense`): read-side для приложений-потребителей
 * (capital, marketplace, EMP). Реализация — расширение `expense-chassis`;
 * токен `INTER_EXPENSE_CHASSIS` регистрируется в InterCommunicationBridgeModule.
 *
 * Mutations approve/authorize/pay/report/close/decline — это прямые GraphQL
 * endpoints шасси; consumer-extension'ы их НЕ оборачивают, чтобы не дублировать
 * lifecycle. Порт нужен только для чтения proposals из инфраструктуры шасси
 * без межсервисных вызовов.
 */

/** Lifecycle-статус proposal'а шасси (зеркало `ExpenseProposalStatus` в `extensions/expenses`). */
export type InterExpenseProposalStatus =
  | 'CREATED'
  | 'AUTHORIZED'
  | 'PARTIALLY_PAID'
  | 'REPORT_SUBMITTED'
  | 'CLOSED'
  | 'DECLINED'
  | 'UNDEFINED';

/** Item — одна строка СЗ-расхода (зеркало `IExpenseItemBlockchainData`). */
export interface InterExpenseItem {
  itemHash: string;
  /** ExpenseMechanics: 0=ADVANCE / 1=DIRECT / 2=POST_FACT (узнать у consumer'а). */
  mechanics: number;
  /** ExpenseRecipientType: 0=USER / 1=ORG / 2=EXTERNAL. */
  recipientType: number;
  /** Получатель: username (USER) / inn (ORG) / свободная строка (EXTERNAL). */
  recipient: string;
  description: string;
  /** Сумма-резерв позиции (raw asset, например "1500.0000 RUB"). */
  plannedAmount: string;
  /** Сумма-факт после `reportexp` (0 пока не отчитались). */
  actualAmount: string;
  /** ExpenseItemStatus blockchain enum. */
  status: number;
}

export interface InterExpenseCallbackHandler {
  /** Owner-контракт consumer'а (для capital'а — `capital`). Пусто = standalone. */
  contract: string;
  action: string;
  data: string;
}

export interface InterExpenseProposalRead {
  coopname: string;
  /** Хэш СЗ-расхода (он же `expense_hash` в capital::progexpenses). */
  proposalHash: string;
  /** Кошелёк-источник (например `BLAGOROST_FUND`). */
  sourceWalletCode: string;
  /** Инициатор (creator) — username председателя, оформившего расход. */
  creator: string;
  status: InterExpenseProposalStatus;
  /** Callback consumer-контракта: пустой `contract` ⇒ standalone-расход без owner'а. */
  callback?: InterExpenseCallbackHandler;
  items: InterExpenseItem[];
  /** Сумма-резерв по items (raw asset). */
  totalPlanned: string;
  /** Фактически потрачено после `reportexp` (raw asset; "0.0000 RUB" пока не отчитались). */
  totalActual: string;
  /** ISO timestamp создания. */
  createdAt: string;
  /** ISO timestamp последнего перехода lifecycle. */
  updatedAt: string;
}

/** Пагинация — нейтральная (не зависит от Nest/TypeORM DTO). */
export interface InterExpensePagination {
  limit?: number;
  offset?: number;
  /** Поле сортировки. По умолчанию `updatedAt`. */
  sortBy?: 'createdAt' | 'updatedAt';
  /** Направление. По умолчанию `DESC`. */
  sortOrder?: 'ASC' | 'DESC';
}

export interface InterExpensePaginatedResult<T> {
  items: T[];
  totalCount: number;
}


/** Строка СЗ для снимка реквизитов получателя (фиксация «куда платить» на момент создания). */
export interface InterExpenseRequisiteItemInput {
  proposalHash: string;
  itemHash: string;
  /** Получатель: username пайщика (владелец платёжного метода) либо пусто для организации. */
  recipient: string;
  /** true — получатель-организация: реквизиты приходят строкой `requisites`. */
  isOrganization: boolean;
  /**
   * Способ оплаты строки. Инвариант шасси: пайщик (SELF/MEMBER) получает только
   * ADVANCE (аванс под отчёт на личные реквизиты, расходом станет после отчёта
   * чеком), организация — только DIRECT (прямая оплата по выставленным реквизитам).
   */
  mechanics: 'ADVANCE' | 'DIRECT';
  /** Идентификатор платёжного метода получателя-пайщика. */
  paymentMethodId?: string;
  /** Реквизиты строкой (организации — ручной ввод из формы). */
  requisites?: string;
  /** Назначение платежа (оплата по счёту) — фиксируется в снимке для кассира. */
  paymentPurpose?: string;
}

export interface InterExpenseChassisPort {
  /**
   * Чтение proposal'а по хэшу. Возвращает null, если шасси не видит
   * (либо хэш чужого кооператива, либо ещё не долетел из parser-stream'а).
   */
  readProposalByHash(coopname: string, proposalHash: string): Promise<InterExpenseProposalRead | null>;

  /**
   * Batch-чтение для list-view (страница «Управление расходами программы» в Капитале).
   * Order не гарантируется — вызывающий сам индексирует по proposalHash.
   */
  readProposalsByHashes(coopname: string, proposalHashes: string[]): Promise<InterExpenseProposalRead[]>;

  /**
   * Список proposals по owner'у (значение `callback.contract`) + опц. action.
   * Используется list-view'ями consumer-extension'ов: «дай мне все программные
   * расходы Капитала» = listProposalsByOwner(coopname, 'capital', 'onpgexpdone').
   */
  listProposalsByOwner(
    coopname: string,
    ownerContract: string,
    ownerAction?: string,
    pagination?: InterExpensePagination,
  ): Promise<InterExpensePaginatedResult<InterExpenseProposalRead>>;

  /**
   * Валидация реквизитов строк СЗ ДО постановки on-chain заявки: у каждой
   * строки с получателем-пайщиком должен существовать указанный платёжный метод.
   */
  validateRequisites(coopname: string, items: InterExpenseRequisiteItemInput[]): Promise<void>;

  /**
   * Снимок реквизитов ПОСЛЕ успешной on-chain заявки: данные платёжного метода
   * копируются в хранилище шасси на момент создания СЗ — последующее изменение
   * метода пайщиком не меняет то, куда платить по уже поданной смете.
   */
  snapshotRequisites(coopname: string, items: InterExpenseRequisiteItemInput[]): Promise<void>;

  /**
   * On-chain оплата позиции СЗ (`expense::payexp`) под подписью кооператива.
   * Вызывается реестром платежей (gateway) при подтверждении кассиром
   * исходящего платежа типа EXPENSE. `actualAmount` — raw asset
   * (например "1000.0000 RUB").
   */
  payItem(coopname: string, proposalHash: string, itemHash: string, actualAmount: string): Promise<void>;

  /**
   * On-chain возврат неиспользованного аванса (`expense::returnexp`) под подписью
   * кооператива. Вызывается реестром платежей при подтверждении кассиром приёма
   * ВХОДЯЩЕГО платежа типа EXPENSE_RETURN (пайщик вернул разницу недорасхода).
   * `returnAmount` — raw asset (модуль разницы факт−аванс, например "200.0000 RUB").
   */
  returnItem(coopname: string, proposalHash: string, itemHash: string, returnAmount: string): Promise<void>;

  /**
   * On-chain доплата при перерасходе (`expense::overspendexp`) под подписью
   * кооператива. Вызывается реестром платежей при подтверждении кассиром выплаты
   * ИСХОДЯЩЕГО платежа типа EXPENSE_OVERSPEND (кооператив доплатил перерасход).
   * `overspendAmount` — raw asset (разница факт−аванс, например "200.0000 RUB").
   */
  overspendItem(coopname: string, proposalHash: string, itemHash: string, overspendAmount: string): Promise<void>;

  /**
   * On-chain закрытие позиции отчётом (`expense::reportexp`) под подписью
   * кооператива. Вызывается реестром платежей после того, как расчёт разницы
   * проведён (returnexp/overspendexp), либо напрямую сервисом отчёта, когда факт
   * совпал с авансом и расчёт разницы не нужен.
   */
  reportItem(coopname: string, proposalHash: string, itemHash: string): Promise<void>;
}
