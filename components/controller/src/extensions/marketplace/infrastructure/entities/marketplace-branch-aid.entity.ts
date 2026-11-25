/**
 * Заявление на материальную помощь доверенного участка — зеркало узла
 * (задача 99D-22, КЭУ-4).
 *
 * Строка цепи (`branch::aids`) стирается при подтверждении выплаты и при отказе
 * совета, а для итога месяца участка нужна сумма помощи, выплаченной за месяц,
 * по участку заявления. Зеркало заполняет слушатель действий контракта branch:
 * `createaid` — подано, `onaidauth` — одобрено, `aidconfirm` — выплачено,
 * `onaiddecl` — отклонено. Хэш заявления равен хэшу исходящего платежа и хэшу
 * процесса ledger2.
 */
export class MarketplaceBranchAidEntity {
  public aid_hash!: string;

  public coopname!: string;

  /** Участок, по которому подано заявление. */
  public braname!: string;

  /** Получатель — председатель или доверенное лицо участка. */
  public username!: string;

  /** Сумма заявления целиком, с налогом; десятичная строка без символа валюты. */
  public amount!: string;

  public status!: MarketplaceBranchAidStatus;

  /** Когда кассир подтвердил перевод; null — не выплачено. */
  public paid_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}

/** Состояние заявления на материальную помощь в зеркале узла. */
export enum MarketplaceBranchAidStatus {
  /** Подано, ждёт решения совета. */
  PROPOSED = 'proposed',
  /** Совет одобрил, ждёт кассира. */
  APPROVED = 'approved',
  /** Кассир подтвердил перевод — расход участка состоялся. */
  PAID = 'paid',
  /** Совет отказал либо срок рассмотрения истёк. */
  DECLINED = 'declined',
}
