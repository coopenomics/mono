import type { PaymentStatusEnum } from '../enums/payment-status.enum';
import type { PaymentTypeEnum } from '../enums/payment-type.enum';

/**
 * Story 598-17 / AR35: создание исходящего платежа без пользовательского
 * заявления (`statement`) и без привязки к платёжному методу пайщика.
 *
 * Используется расширениями (например, marketplace) для регистрации в
 * core-реестре платежей системных выплат — кассирский стол видит такие
 * платежи в общей ленте вместе с обычными пайщик-инициированными.
 * Авторизация — на стороне extension'а, который вызывает метод;
 * `related_extension` фиксирует источник.
 */
export interface CreateSystemOutgoingPaymentInputDomainInterface {
  coopname: string;
  /** Получатель платежа — аккаунт поставщика, кооператива или сервиса. */
  username: string;
  quantity: number;
  symbol: string;
  /** Описание назначения (для UI кассирского стола). */
  memo: string;
  /** Тип платежа для кассирского реестра. По умолчанию — `PAYMENT` (обычная покупка). */
  type?: PaymentTypeEnum;
  /**
   * Начальный статус. По умолчанию — `PENDING` (кассир видит платёж сразу).
   * Если выплата требует решения совета, extension создаёт платёж со статусом
   * `AWAITING_AUTHORIZATION` — кассиру он скрыт, пока решение не принято, а
   * перевод в `PENDING` делает слушатель callback'а совета.
   */
  status?: PaymentStatusEnum;
  /** Имя инициирующего расширения, например `marketplace`. */
  related_extension: string;
  /** ID сущности расширения, по которой инициирован платёж. */
  related_entity_id: string;
  /** Детерминированный hash для идемпотентности (на стороне extension). */
  payment_hash: string;
  /**
   * Опционально — платёжный метод получателя (реквизиты пайщика из ядра),
   * снапшот которых extension кладёт в payment_details: кассир видит,
   * куда переводить, прямо в реестре платежей.
   */
  payment_method_id?: string;
  /** Опционально — payment_details (если extension умеет их сформировать). */
  payment_details?: {
    data: any;
    amount_plus_fee: string;
    amount_without_fee: string;
    fee_amount: string;
    fee_percent: number;
    fact_fee_percent: number;
    tolerance_percent: number;
  };
}
