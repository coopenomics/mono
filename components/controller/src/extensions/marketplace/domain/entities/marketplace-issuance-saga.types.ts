import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Сага выдачи имущества в паевой модели (компонент 68, задача 99D-7).
 *
 * Под кнопкой пайщика «Подписать и получить» лежат две подписи и до четырёх
 * транзакций с ожиданием решения совета; держать эту цепочку на телефоне
 * нельзя — связь рвётся, приложение сворачивается. Сагу ведёт бэкенд: одна
 * запись на заказ, этапы идемпотентны, устройство только ставит подписи и
 * при возвращении в приложение открывается на текущем этапе.
 *
 * Этапы (в порядке пути):
 *  - FACT_FIXED         — оператор зафиксировал факт (кол-во, цена), заявления ещё нет;
 *  - STATEMENT_SIGNED   — заявление 1113 подписано, `issuestmt` в цепи, номер решения ещё не известен;
 *  - DECISION_PENDING   — повестка совета открыта, ждём решение (робот или люди);
 *  - DECISION_AUTHORIZED — протокол 1114 получен (`onmktisauth`), акт 1115 сформирован — ждём подпись пайщика;
 *  - ACT1_SIGNED        — акт подписан пайщиком (`issueact1`), ждём закрывающую подпись оператора;
 *  - CLOSED             — закрывающая подпись поставлена (`issueact2`), заказ выдан;
 *  - DECLINED           — совет отказал (`onmktisdecl`), заказ вернулся в «готов к выдаче»;
 *  - CANCELLED          — оператор отменил начатую выдачу (`cancelissue`).
 */
export type MarketplaceIssuanceSagaStage =
  | 'FACT_FIXED'
  | 'STATEMENT_SIGNED'
  | 'DECISION_PENDING'
  | 'DECISION_AUTHORIZED'
  | 'ACT1_SIGNED'
  | 'CLOSED'
  | 'DECLINED'
  | 'CANCELLED';

export const MarketplaceIssuanceSagaStages = {
  FACT_FIXED: 'FACT_FIXED',
  STATEMENT_SIGNED: 'STATEMENT_SIGNED',
  DECISION_PENDING: 'DECISION_PENDING',
  DECISION_AUTHORIZED: 'DECISION_AUTHORIZED',
  ACT1_SIGNED: 'ACT1_SIGNED',
  CLOSED: 'CLOSED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<string, MarketplaceIssuanceSagaStage>;

/** Этапы, на которых сага ещё жива и требует чьего-то действия или ожидания. */
export const MARKETPLACE_ISSUANCE_SAGA_ACTIVE_STAGES: ReadonlySet<MarketplaceIssuanceSagaStage> = new Set([
  'FACT_FIXED',
  'STATEMENT_SIGNED',
  'DECISION_PENDING',
  'DECISION_AUTHORIZED',
  'ACT1_SIGNED',
]);

/**
 * Как принято решение совета по этой выдаче: роботом за секунды или людьми в
 * повестке. От этого зависит, что видит пайщик: короткий индикатор или
 * спокойный режим ожидания с уведомлением.
 */
export type MarketplaceIssuanceDecisionMode = 'ROBOT' | 'MANUAL' | 'UNKNOWN';

/** Факт выдачи, зафиксированный оператором у стойки. */
export interface MarketplaceIssuanceSagaFact {
  /** Фактически выдаваемое количество в базовой единице. */
  actual_quantity: number;
  /** Фактическая цена за единицу отпуска (десятичная строка). */
  actual_unit_price: string;
  /** Фактическая сумма выдачи (десятичная строка). */
  fact_cost: string;
}

/** Транзакции саги — для аудита и повторов. */
export interface MarketplaceIssuanceSagaTxHashes {
  readyissue?: string;
  issuestmt?: string;
  issueact1?: string;
  issueact2?: string;
  cancelissue?: string;
}

export interface MarketplaceIssuanceSagaProps {
  id: string;
  coopname: string;
  order_id: string;
  order_hash: string;
  /** Бандл выдачи у стойки, в составе которого началась сага (null — одиночная выдача). */
  proposal_id: string | null;
  member_account: string;
  operator_account: string;
  braname: string;
  stage: MarketplaceIssuanceSagaStage;
  decision_mode: MarketplaceIssuanceDecisionMode;
  fact: MarketplaceIssuanceSagaFact;
  /** Заявление 1113 с подписью пайщика. */
  statement_document: ISignedDocument | null;
  /** Протокол 1114 из обратного вызова совета. */
  protocol_document: ISignedDocument | null;
  /** Акт 1115: первая подпись пайщика (после подписи — двухподписный вариант в act2_document). */
  act1_document: ISignedDocument | null;
  /** Акт 1115 с обеими подписями. */
  act2_document: ISignedDocument | null;
  /** Хэш сгенерированного акта (исходник в сторе документов) — чтобы устройство пайщика взяло агрегат. */
  act_document_hash: string | null;
  /** Номер решения совета (soviet.decisions). */
  decision_id: string | null;
  tx_hashes: MarketplaceIssuanceSagaTxHashes;
  last_error: string | null;
  /** Число попыток сторожа дожать этап. */
  attempts: number;
  decided_at: Date | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
