import type {
  InnerPage,
  InnerPageRequest,
  InnerPayment,
  InnerPaymentDetails,
  InnerPaymentFilters,
  PaymentStatus,
  PaymentType,
} from './payment.port';

/**
 * Кассирский стол — операции над платежом, а не записи о нём.
 *
 * Отличается от `IPaymentPort` уровнем: тот заводит и правит запись в реестре,
 * этот проводит платёж. Смена статуса здесь тянет за собой процессинг —
 * проводку в цепь, уведомление, закрытие связанной операции, — поэтому
 * расширение обязано звать её, а не переписывать поле `status` напрямую.
 *
 * Порт **не скоупит доступ**: право распоряжаться платежом проверяет
 * вызывающий до обращения сюда.
 */

export interface InnerSetPaymentStatusInput {
  id: string;
  status: PaymentStatus;
  /** Причина — например, за что платёж отклонён. Видна в реестре. */
  message?: string;
}

/**
 * Выплата, инициированная расширением: без заявления пайщика и без привязки к
 * его платёжному методу. Кассир видит её в общей ленте наравне с обычными.
 */
export interface InnerSystemOutgoingPaymentInput {
  coopname: string;
  /** Получатель — поставщик, кооператив или служба. */
  username: string;
  quantity: number;
  symbol: string;
  /** Назначение платежа для кассира. */
  memo: string;
  /** По умолчанию обычная покупка. */
  type?: PaymentType;
  /**
   * Платёж сразу виден кассиру. Выплату, которую решает совет, расширение
   * заводит заявкой (`registerPayoutRequest`), а не платежом: статус «ожидает
   * решения совета» здесь отклоняется.
   */
  status?: PaymentStatus;
  /** Кто инициировал выплату — по нему кассирский стол отделяет её от обычных. */
  related_extension: string;
  /** Сущность расширения, ради которой выплата заведена. */
  related_entity_id: string;
  /** Хэш для повторного вызова: расширение считает его само и отвечает за устойчивость. */
  payment_hash: string;
  /** Реквизиты получателя, если расширение знает, куда переводить. */
  payment_method_id?: string;
  payment_details?: InnerPaymentDetails;
}

/** Состояние заявки на выплату. */
export enum InnerPayoutRequestStatus {
  /** Совет ещё не решил — платежа кассиру нет. */
  AWAITING = 'awaiting',
  /** Совет разрешил — платёж кассиру создан. */
  RELEASED = 'released',
  /** Совет отказал — платежа не будет. */
  DECLINED = 'declined',
}

/**
 * Заявка на выплату до решения совета: сумма и реквизиты, выбранные при
 * подаче. Реквизиты живут в базе узла, в цепь не попадают. Хэш заявки станет
 * хэшем платежа.
 */
export interface InnerPayoutRequest {
  hash: string;
  coopname: string;
  username: string;
  quantity: number;
  symbol: string;
  type: PaymentType;
  payment_method_id?: string | null;
  status: InnerPayoutRequestStatus;
  created_at: Date;
  /** Когда совет решил; пусто — решения ещё нет. */
  decided_at?: Date | null;
}

export interface IPaymentDeskPort {
  /** Страница платежей кассирского реестра по отбору. */
  getPayments(filters: InnerPaymentFilters, page: InnerPageRequest): Promise<InnerPage<InnerPayment>>;

  /** Перевести платёж в новое состояние вместе с сопутствующим процессингом. */
  setPaymentStatus(input: InnerSetPaymentStatusInput): Promise<InnerPayment>;

  createSystemOutgoingPayment(input: InnerSystemOutgoingPaymentInput): Promise<InnerPayment>;

  /**
   * Выплата, которую решает совет: сохранить заявку с суммой и реквизитами.
   * Платежа кассиру до решения нет. Хэш занят — отказ.
   */
  registerPayoutRequest(input: InnerSystemOutgoingPaymentInput): Promise<InnerPayoutRequest>;

  /**
   * Совет разрешил выплату — создать платёж кассиру из заявки. Повтор события
   * второго платежа не создаёт. Null — заявки нет либо она отклонена.
   */
  releasePayoutRequest(hash: string): Promise<InnerPayment | null>;

  /** Совет отказал — заявка закрывается, платежа не будет. */
  declinePayoutRequest(hash: string): Promise<void>;

  /** Подача в цепь не удалась — снять заявку, не дошедшую до совета. */
  dropPayoutRequest(hash: string): Promise<void>;

  /** Заявка по хэшу; null — заявки нет. */
  getPayoutRequest(hash: string): Promise<InnerPayoutRequest | null>;

  /**
   * Учётные имена тех, кто подтверждает платежи в реестре: председатель и
   * пайщики с ролью «Кассир». Им расширение шлёт задачу «подтвердите платёж».
   */
  confirmers(): Promise<string[]>;
}

export const PAYMENT_DESK_PORT = Symbol.for('Innercoop.CorePort.PaymentDesk');
