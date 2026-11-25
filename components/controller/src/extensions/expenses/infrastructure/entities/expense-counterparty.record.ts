/**
 * Контрагент шасси расходов — организация или ИП, которым кооператив платит
 * по реквизитам (задача 99D-35). Реквизиты — объект по полям страны
 * кооператива (пакет юрисдикций); налоговый номер повторён колонкой для
 * поиска и распознавания повтора.
 */
export class ExpenseCounterpartyRecord {
  id!: number;

  coopname!: string;

  /** Участок, который добавил контрагента; `null` — контрагент кооператива. */
  braname!: string | null;

  /** Вид контрагента — `ExpenseCounterpartyKind`. */
  kind!: string;

  name!: string;

  tax_id!: string;

  requisites!: Record<string, string>;

  payment_purpose!: string | null;

  archived!: boolean;

  creator!: string;

  created_at!: Date;

  updated_at!: Date;
}
