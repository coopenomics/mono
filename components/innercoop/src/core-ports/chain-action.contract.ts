/**
 * Действие, применённое в цепи, — как его отдаёт узел вместе с квитанцией.
 *
 * Расширение получает такие записи, когда следит за своим контрактом:
 * подписывается на действия и реагирует на них. Форма приходит из цепи целиком,
 * поэтому здесь она описана как есть, а не сокращена: у поля `data` состав
 * задаёт ABI контракта и меняется вместе с ним.
 *
 * `repeat` отмечает повторную доставку — то же действие могло прийти снова
 * после переподключения к потоку, и обработчик обязан это пережить.
 */
export interface InnerChainActionRecord {
  /**
   * Идентификатор записи в журнале действий. У события, пришедшего по
   * внутренней шине, его ещё нет: он появляется, когда действие записано.
   */
  id?: string;
  transaction_id: string;
  /** Контракт, которому действие адресовано. */
  account: string;
  block_num: number;
  block_id: string;
  chain_id: string;
  /** Имя действия в контракте. */
  name: string;
  /** Контракт, до которого действие дошло: у уведомлений он отличается от `account`. */
  receiver: string;
  authorization: Array<{ actor: string; permission: string }>;
  /** Поля действия; состав задаёт ABI контракта. */
  data: Record<string, any>;
  /** Порядковый номер действия внутри транзакции. */
  action_ordinal: number;
  /** Сквозной номер действия в цепи — строка, потому что не помещается в число. */
  global_sequence: string;
  account_ram_deltas: Array<{ account: string; delta: number }>;
  /** Вывод контракта, если он печатал. */
  console?: string;
  receipt: {
    receiver: string;
    act_digest: string;
    global_sequence: string;
    recv_sequence: string;
    auth_sequence: Array<{ account: string; sequence: string }>;
    code_sequence: number;
    abi_sequence: number;
  };
  /** Действие, породившее это; ноль у действия верхнего уровня. */
  creator_action_ordinal: number;
  context_free: boolean;
  /** Время выполнения, мкс. */
  elapsed: number;
  /** Повторная доставка того же действия. */
  repeat?: boolean;
  /** Когда действие записано в журнал; у события из шины отсутствует. */
  created_at?: Date;
}
