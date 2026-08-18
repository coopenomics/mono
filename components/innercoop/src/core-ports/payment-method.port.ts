import type { InnerPage, InnerPageRequest } from './payment.port';

/**
 * Платёжные методы пайщика — куда кооперативу отправлять деньги.
 *
 * Расширения читают реквизиты, чтобы показать их кассиру и вписать в
 * закрывающие документы, и заводят метод за пайщика, когда получают реквизиты
 * из своего потока. Раньше для этого инжектился `PAYMENT_METHOD_REPOSITORY` по
 * пути `~/domain/common`, которого за пределами монолита нет.
 *
 * Порт **не скоупит доступ**: чужие реквизиты — чувствительные данные, и право
 * их смотреть проверяет вызывающий до обращения сюда.
 */

/** Способ получения денег. */
export type InnerPaymentMethodType = 'sbp' | 'bank_transfer';

/** Перевод по номеру телефона. */
export interface InnerSbpData {
  phone: string;
}

/** Перевод на банковский счёт. */
export interface InnerBankTransferData {
  account_number: string;
  bank_name: string;
  card_number?: string;
  currency: string;
  details: {
    bik: string;
    corr: string;
  };
}

export interface InnerPaymentMethod<TData = InnerSbpData | InnerBankTransferData> {
  username: string;
  method_id: string;
  method_type: InnerPaymentMethodType;
  data: TData;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Новый метод: даты проставляет ядро при записи, признак «по умолчанию» —
 * необязателен.
 */
export interface InnerPaymentMethodDraft<TData = InnerSbpData | InnerBankTransferData> {
  username: string;
  method_id: string;
  method_type: InnerPaymentMethodType;
  data: TData;
  is_default?: boolean;
}

/** Отбор метода. Без `method_id` берётся метод по умолчанию. */
export interface InnerPaymentMethodQuery {
  username: string;
  method_type?: InnerPaymentMethodType;
  method_id?: string;
  is_default?: boolean;
}

export interface IPaymentMethodPort {
  /** Метод по отбору; бросает, если подходящего нет. */
  get(query: InnerPaymentMethodQuery): Promise<InnerPaymentMethod>;

  list(username: string, page: InnerPageRequest): Promise<InnerPage<InnerPaymentMethod>>;

  /** Завести или обновить метод. Доменную сущность собирает ядро. */
  save(method: InnerPaymentMethodDraft): Promise<InnerPaymentMethod>;

  remove(username: string, methodId: string): Promise<void>;
}

export const PAYMENT_METHOD_PORT = Symbol.for('Innercoop.CorePort.PaymentMethod');
