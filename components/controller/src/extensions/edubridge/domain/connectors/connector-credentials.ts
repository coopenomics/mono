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
}

export const CONNECTOR_CREDENTIALS_SOURCE = Symbol('CONNECTOR_CREDENTIALS_SOURCE');
