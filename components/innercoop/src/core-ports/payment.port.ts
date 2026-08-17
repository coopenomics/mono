import type { ISignedDocument } from './signed-document.port';

/**
 * Платежи кооператива: найти по хэшу, завести новый, обновить состояние.
 *
 * Расширения заводят платежи (оплата позиции служебной записки, возврат аванса,
 * материальная помощь) и следят за их состоянием, а расчётный контур —
 * реквизиты, провайдеры, кассирский стол — остаётся в ядре. Раньше расширение
 * инжектило `PAYMENT_REPOSITORY` по пути `~/domain/gateway`, которого за
 * пределами монолита нет.
 *
 * Порт **не скоупит доступ**: право пайщика видеть или менять платёж проверяет
 * вызывающий до обращения сюда.
 */

/**
 * Состояние платежа. Значения — часть контракта: расширение сравнивает с ними
 * напрямую и по ним же решает, наступил ли момент проводки в цепь.
 *
 * Регистрация перечня в схеме GraphQL остаётся в ядре: расширениям нужны
 * значения, а не тип поля.
 */
export enum PaymentStatus {
  /** Исходящий платёж, по которому совет ещё не принял решение. Кассиру не виден. */
  AWAITING_AUTHORIZATION = 'awaiting_authorization',

  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  COMPLETED = 'completed',

  FAILED = 'failed',
  EXPIRED = 'expired',

  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Назначение платежа. Перечень общий: расширение заводит платёж своего типа, а
 * кассирский стол ядра обязан такой тип понимать.
 */
export enum PaymentType {
  /** Вступительный и минимальный паевой взносы. */
  REGISTRATION = 'registration',
  /** Паевой взнос. */
  DEPOSIT = 'deposit',
  /** Возврат паевого взноса действующему пайщику. */
  WITHDRAWAL = 'withdrawal',
  /** Оплата третьему лицу или поставщику — покупка, а не возврат паевого взноса. */
  PAYMENT = 'payment',
  /** Возврат вступительного и минимального паевого взносов при отказе в приёме. */
  REGISTRATION_REFUND = 'registration_refund',
  /** Возврат паевого взноса целиком при выходе пайщика из кооператива. */
  MEMBERSHIP_EXIT = 'membership_exit',
  /** Оплата позиции служебной записки-сметы. */
  EXPENSE = 'expense',
  /** Возврат неиспользованного аванса под отчёт. */
  EXPENSE_RETURN = 'expense_return',
  /** Доплата при перерасходе аванса под отчёт. */
  EXPENSE_OVERSPEND = 'expense_overspend',
  /** Материальная помощь доверенному кооперативного участка. */
  AID = 'aid',
  /**
   * Перечисление удержанного налога в бюджет. Кооператив выступает налоговым
   * агентом: удержал при выплате — обязан перечислить, поэтому получателя-пайщика
   * у такого платежа нет.
   */
  TAX = 'tax',
}

/**
 * Налоговая оговорка в назначении платежа. Взносы пайщика и их возврат НДС не
 * облагаются, и оговорка обязана стоять в memo целиком: провайдеры QR её не
 * дописывают, чтобы не задвоить. Живёт в контракте, потому что назначение
 * платежа формируют и ядро, и расширения — второй копии быть не должно.
 */
export const VAT_EXEMPT_NOTE = 'НДС не облагается.';

/** Направление движения средств относительно кооператива. */
export enum PaymentDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

/** Сумма платежа в разбивке на тело и комиссию провайдера. */
export interface InnerPaymentDetails {
  /** Реквизиты, QR-код или токен провайдера — форма зависит от способа оплаты. */
  data: Record<string, any>;
  amount_plus_fee: string;
  amount_without_fee: string;
  fee_amount: string;
  fee_percent: number;
  fact_fee_percent: number;
  tolerance_percent: number;
}

/**
 * Платёж в реестре кооператива — единая форма для входящих и исходящих.
 */
export interface InnerPayment {
  id?: string;

  /** Хэш платежа: он же связывает платёж с сущностью, ради которой он заведён. */
  hash: string;

  coopname: string;

  /**
   * Кому платёж принадлежит лично. Для платежа самого кооператива (получатель —
   * организация) здесь стоит `coopname`, и в личных реестрах пайщиков он не
   * виден.
   */
  username: string;

  quantity: number;
  symbol: string;

  type: PaymentType;
  direction: PaymentDirection;
  status: PaymentStatus;

  provider?: string;
  payment_method_id?: string;
  secret?: string;
  message?: string;

  /** Назначение платежа: кассир копирует его в платёжное поручение как есть. */
  memo?: string;

  expired_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  created_at: Date;
  updated_at?: Date;

  payment_details?: InnerPaymentDetails;

  /** Данные для проводки в цепь: состав зависит от типа платежа. */
  blockchain_data?: Record<string, any>;

  /** Подписанное заявление пайщика — у исходящих платежей по заявлению. */
  statement?: ISignedDocument;

  /** Расширение, заведшее платёж, — по нему кассирский стол отделяет их от обычных. */
  related_extension?: string | null;

  /** Идентификатор сущности расширения, ради которой платёж заведён. */
  related_entity_id?: string | null;
}

/** Новый платёж: идентификатор присваивает ядро при записи в реестр. */
export type InnerPaymentDraft = Omit<InnerPayment, 'id'>;

/** Отбор платежей. Пустой отбор означает «все платежи кооператива». */
export interface InnerPaymentFilters {
  coopname?: string;
  username?: string;
  status?: PaymentStatus;
  type?: PaymentType;
  direction?: PaymentDirection;
  provider?: string;
  hash?: string;

  /**
   * Секрет платежа. Способ оплаты кладёт его в метаданные счёта и получает
   * обратно в уведомлении банка — по нему платёж и опознаётся, когда своего
   * идентификатора в уведомлении нет.
   */
  secret?: string;
}

/** Запрос страницы. Нумерация страниц с единицы. */
export interface InnerPageRequest {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: 'ASC' | 'DESC';
}

export interface InnerPage<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface IPaymentPort {
  /** Платёж по хэшу связанной сущности; `null`, если платёж ещё не заведён. */
  findByHash(hash: string): Promise<InnerPayment | null>;

  create(payment: InnerPaymentDraft): Promise<InnerPayment>;

  /** Точечное обновление; `null`, если платежа с таким идентификатором нет. */
  update(id: string, data: Partial<InnerPayment>): Promise<InnerPayment | null>;

  /**
   * Страница платежей по отбору. Нужна провайдерам оплаты: уведомление банка
   * приходит без хэша платежа, и найти его удаётся только перебором ожидающих.
   */
  list(filters: InnerPaymentFilters, page: InnerPageRequest): Promise<InnerPage<InnerPayment>>;
}

export const PAYMENT_PORT = Symbol.for('Innercoop.CorePort.Payment');
