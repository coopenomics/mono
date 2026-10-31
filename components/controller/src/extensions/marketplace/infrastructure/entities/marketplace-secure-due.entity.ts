/**
 * Обеспечительная часть паевого взноса к списанию по заказу (задача 99D-18).
 *
 * Строка на заказ. Суммы — те, что провёл контракт (операции ledger2
 * o.mkt.todue, o.mkt.penal, o.mkt.undue, o.mkt.charge, o.mkt.exfee); узел их
 * не вычисляет. Крон первого числа месяца списывает остаток строк, у которых
 * `due_from` раньше начала месяца, действием `chargedue`.
 */
export class MarketplaceSecureDueEntity {
  /** Хэш заказа — хэш процесса, под которым идут все операции заказа. */
  public order_hash!: string;

  public coopname!: string;

  /** Заказчик — владелец кошелька к списанию. */
  public username!: string;

  /** Участок выдачи заказа — получатель членского взноса при списании. */
  public braname!: string;

  /** Остаток к списанию, десятичная строка без символа валюты. */
  public due_amount!: string;

  /** Списано в членский взнос, десятичная строка без символа валюты. */
  public charged_amount!: string;

  /** С какого момента остаток можно списывать: конец гарантийного срока; null — ещё не известен. */
  public due_from!: Date | null;

  /** Когда остаток списан целиком; null — не списан. */
  public charged_at!: Date | null;

  /** Сквозной номер последней учтённой операции — повтор события не учитывается дважды. */
  public last_sequence!: string;

  public created_at!: Date;

  public updated_at!: Date;
}
