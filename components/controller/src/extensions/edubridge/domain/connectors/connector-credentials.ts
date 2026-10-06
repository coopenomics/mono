import type { EduAccessCarrier } from '../enums';

/** Что площадке нужно от кооператива для подключения: одно поле формы. */
export interface ConnectorCredentialField {
  key: string;
  label: string;
  /** Секрет: в интерфейсе вводится как пароль и наружу никогда не отдаётся. */
  secret: boolean;
  note?: string;
}

/** Значения полей подключения площадки — ключи API, аккаунты. */
export type ConnectorCredentials = Record<string, string>;

/**
 * Откуда коннектор берёт учётные данные площадки. Площадок может быть сколько
 * угодно, а редактирование их ключей делегируется владельцем со страницы
 * «Площадки» — поэтому ключи живут в собственной таблице расширения
 * (зашифрованными), а не в настройках расширения.
 */
export interface IConnectorCredentialsSource {
  get(coopname: string, carrier: EduAccessCarrier): Promise<ConnectorCredentials>;
  /**
   * Базовый адрес API площадки из настроек расширения. Обычно — адрес самой
   * площадки; подменяется на стенде, чтобы сценарии с площадкой шли против
   * подставного узла. Нет метода либо значения — коннектор берёт адрес площадки.
   */
  apiBase?(carrier: EduAccessCarrier): Promise<string | undefined>;
}

export const CONNECTOR_CREDENTIALS_SOURCE = Symbol('CONNECTOR_CREDENTIALS_SOURCE');
