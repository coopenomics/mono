/**
 * Итог месяца кооперативного участка — зеркало строки `kuperiods` контракта
 * marketplace (задача 99D-22, КЭУ-4).
 *
 * В цепи у участка хранятся только две строки (текущий и прошлый прогон);
 * узел хранит историю всех прогонов для экранов экономики участка. Суммы и
 * ставки — те, что рассчитал контракт в `closeperiod`; узел их не считает,
 * а читает строку цепи после расчёта. Счётчики строк прогона ведёт узел.
 */
export class MarketplaceBranchPeriodEntity {
  public coopname!: string;

  /** Кооперативный участок. */
  public braname!: string;

  /** Номер прогона: год × 12 + месяц по часовому поясу кооператива (на стенде — отрезок шкалы). */
  public period!: number;

  /** T — стоимость заказов прогона. */
  public turnover!: string;

  /** C — собранная обеспечительная часть прогона. */
  public secured!: string;

  /** ПР — плановые расходы участка за месяц. */
  public planned!: string;

  /** СЗ — служебные записки сверх плана за месяц. */
  public memos!: string;

  /** МП — материальная помощь, выплаченная за месяц. */
  public aid_paid!: string;

  /** Р — резерв социально-экономического обеспечения пайщиков на следующий месяц. */
  public aid_reserve!: string;

  /** Н — невыплаченная часть прошлого резерва. */
  public aid_unpaid!: string;

  /** РК — расходы участка за прогон. */
  public expenses!: string;

  /** М — членский взнос участка за прогон. */
  public membership!: string;

  /** Ф — в фонды накопления кооператива. */
  public funds_amount!: string;

  /** У — участку на расходы. */
  public branch_amount!: string;

  /** И — инициатору участка. */
  public initiator_amount!: string;

  /** В — пайщикам обратно. */
  public return_amount!: string;

  /** Д — дефицит участка. */
  public deficit!: string;

  /** Ставки прогона, доли HUNDR_PERCENTS (1 000 000 = 100 %). */
  public rate_branch!: string;
  public rate_funds!: string;
  public rate_initiator!: string;

  /** Получатель доли инициатора на момент прогона. */
  public initiator!: string;

  /** Строк учёта в прогоне и сколько из них списано. */
  public rows_total!: number;
  public rows_charged!: number;

  /** Когда контракт рассчитал итог. */
  public closed_at!: Date;

  /** Когда строка стёрта из цепи (`delperiod`); null — ещё в цепи. */
  public deleted_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
