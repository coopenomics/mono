import type { EduAccessCarrier, EduRecipientType } from '../enums';

/** Кому выдаётся пропуск: площадке уходит только этот контакт и ничего больше. */
export interface AccessRecipient {
  type: EduRecipientType;
  value: string;
  /** Имя для площадки, если она требует; по умолчанию — не передаётся. */
  display_name?: string;
}

export interface AccessRequest {
  coopname: string;
  recipient: AccessRecipient;
  /** Идентификатор курса на площадке (Course.external_ref). */
  course_ref: string;
  /** Справочно для логов площадки. */
  enrollment_id: string;
}

export type ConnectorResultCode = 'ok' | 'retryable' | 'fatal' | 'exists';

export interface ConnectorResult {
  code: ConnectorResultCode;
  message?: string;
  /** Код ошибки площадки, если есть; `LICENSE_LIMIT` — исчерпан лимит лицензии. */
  error_code?: string;
}

export interface CourseCheckResult {
  /** Курс найден на площадке. */
  found: boolean;
  /** Название курса на площадке — для обнаружения переименования. */
  title?: string;
  /** Площадка недоступна — результат неизвестен. */
  unavailable?: boolean;
  message?: string;
}

/**
 * Единый контракт носителя доступа. Добавление площадки — новый класс в
 * `infrastructure/connectors`, общий код выдачи не меняется.
 */
export interface AccessCarrierConnector {
  readonly carrier: EduAccessCarrier;
  grant(request: AccessRequest): Promise<ConnectorResult>;
  revoke(request: AccessRequest): Promise<ConnectorResult>;
  check(coopname: string, courseRef: string): Promise<CourseCheckResult>;
}

export const ACCESS_CARRIER_CONNECTORS = Symbol('ACCESS_CARRIER_CONNECTORS');
