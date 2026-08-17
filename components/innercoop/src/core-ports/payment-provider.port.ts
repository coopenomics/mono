import type { InnerPaymentDetails } from './payment.port';

/**
 * Реестр способов оплаты.
 *
 * Расширение-провайдер (эквайринг, СБП, касса банка) кладёт себя в реестр при
 * запуске, а расчётный контур ядра достаёт его оттуда по имени, когда пайщик
 * выбрал этот способ. Раньше расширение инжектило `PROVIDER_PORT` по пути
 * `~/domain/gateway`, которого за пределами монолита нет.
 *
 * Регистрация — единственный способ появиться в списке способов оплаты: ядро
 * не знает провайдеров по именам заранее.
 */

/**
 * Способ оплаты со стороны расширения — то, что ядро вызывает у провайдера.
 *
 * Уведомление банка о платеже (IPN) провайдер принимает сам своим маршрутом,
 * поэтому в контракте его нет: ядро туда не ходит.
 */
export interface IPaymentProvider {
  /**
   * Выдать реквизиты для оплаты заведённого платежа: QR-код, ссылку на форму
   * эквайринга или банковские реквизиты — что именно, решает провайдер.
   */
  createPayment(hash: string): Promise<InnerPaymentDetails>;
}

export interface IPaymentProviderRegistryPort {
  /** Имя обязано совпадать с тем, под которым способ оплаты предлагается пайщику. */
  registerProvider(name: string, provider: IPaymentProvider): void;

  getProvider(name: string): IPaymentProvider | undefined;
}

export const PAYMENT_PROVIDER_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.PaymentProviderRegistry');

/**
 * Метка прочитанного в банковской выписке: до какой страницы за какой день
 * способ оплаты уже дошёл.
 */
export interface InnerPaymentPollingState {
  accountNumber: string;
  statementDate: string;
  lastProcessedPage: number;
}

/**
 * Хранилище меток для способов оплаты, узнающих о зачислении опросом.
 *
 * Метка переживает перезапуск, поэтому лежит в ядре: иначе после рестарта
 * расширение перечитывало бы выписку с начала дня и повторно засчитывало
 * платежи.
 */
export interface IPaymentPollingStatePort {
  find(accountNumber: string, statementDate: string): Promise<InnerPaymentPollingState | null>;
  save(state: InnerPaymentPollingState): Promise<InnerPaymentPollingState>;
}

export const PAYMENT_POLLING_STATE_PORT = Symbol.for('Innercoop.CorePort.PaymentPollingState');

/** Запись об уведомлении банка о зачислении, как она пришла. */
export interface InnerPaymentNotice {
  id?: string;
  /** Имя способа оплаты, приславшего уведомление. */
  provider: string;
  data: object;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Журнал уведомлений банка.
 *
 * Банк повторяет уведомление, пока не получит подтверждения, поэтому способ
 * оплаты сперва ищет его в журнале и лишь потом засчитывает платёж: журнал —
 * то, что отличает повтор от нового зачисления.
 */
export interface IPaymentNoticeLogPort {
  find(criteria: Partial<InnerPaymentNotice>): Promise<InnerPaymentNotice | null>;
  record(notice: Omit<InnerPaymentNotice, 'id' | 'created_at' | 'updated_at'>): Promise<InnerPaymentNotice>;
}

export const PAYMENT_NOTICE_LOG_PORT = Symbol.for('Innercoop.CorePort.PaymentNoticeLog');
