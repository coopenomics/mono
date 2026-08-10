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
   * По умолчанию платёж сразу виден кассиру. Если выплата ждёт решения совета,
   * расширение заводит её ожидающей решения — кассиру она скрыта, пока решение
   * не принято.
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

export interface IPaymentDeskPort {
  /** Страница платежей кассирского реестра по отбору. */
  getPayments(filters: InnerPaymentFilters, page: InnerPageRequest): Promise<InnerPage<InnerPayment>>;

  /** Перевести платёж в новое состояние вместе с сопутствующим процессингом. */
  setPaymentStatus(input: InnerSetPaymentStatusInput): Promise<InnerPayment>;

  createSystemOutgoingPayment(input: InnerSystemOutgoingPaymentInput): Promise<InnerPayment>;
}

export const PAYMENT_DESK_PORT = Symbol.for('Innercoop.CorePort.PaymentDesk');
