import type { IMonoAccount } from './mono-account.contract';

/**
 * Учётные записи пайщиков кооператива: найти по имени, перечислить с
 * пагинацией, получить человеческое имя для показа.
 *
 * Порт уже существовал в ядре как `AccountDataPort` и уже инжектился
 * расширениями по токену — переезд нужен потому, что возвращал он
 * `AccountDomainEntity`, класс с путями `~/...`, которых за пределами монолита
 * нет.
 *
 * Порт **не скоупит доступ**: он отдаёт то, что попросили. Кто вправе смотреть
 * чужую учётную запись, решает резолвер расширения до вызова (ADR-16).
 */

/** Тип субъекта: физлицо, организация, индивидуальный предприниматель. */
/**
 * Кем пайщик состоит в кооперативе. Перечень, а не строки: значения нужны и
 * расширению для сравнения, и ядру — для регистрации в схеме GraphQL, а два
 * параллельных списка со временем разошлись бы.
 */
export enum InnerAccountType {
  individual = 'individual',
  entrepreneur = 'entrepreneur',
  organization = 'organization',
}

/** Организационно-правовая форма юридического лица. */
export enum InnerOrganizationType {
  COOP = 'coop',
  PRODCOOP = 'prodcoop',
  OOO = 'ooo',
  OAO = 'oao',
  ZAO = 'zao',
  PAO = 'pao',
  AO = 'ao',
}

/**
 * Персональные данные пайщика. Состав зависит от типа субъекта, поэтому блоки
 * необязательные: у физлица заполнен `individual_data`, у организации —
 * `organization_data`.
 */
export interface InnerPrivateAccount {
  type: InnerAccountType;
  individual_data?: Record<string, any>;
  organization_data?: Record<string, any>;
  entrepreneur_data?: Record<string, any>;
}

/**
 * Учётная запись целиком.
 *
 * Блоки, приходящие из цепи (`blockchain_account`, `user_account`,
 * `participant_account`), намеренно оставлены нетипизированными: их форму
 * задаёт контракт, а расширения к ним не обращаются вовсе — замер показал ноль
 * обращений. Типизировать их здесь значило бы либо тащить `cooptypes` в
 * контрактный пакет, либо переписывать формы вручную и держать их в
 * синхронизации с цепью. Понадобится поле — оно объявляется явно, а не оптом.
 */
export interface InnerAccount {
  username: string;
  /** Учётная запись у провайдера контура: почта, подписка, статус. */
  provider_account: IMonoAccount | null;
  private_account: InnerPrivateAccount | null;
  /** Вид субъекта: пайщик, кооперативный участок, кооператив, прочее. */
  account_kind: string;
  blockchain_account: Record<string, any> | null;
  user_account: Record<string, any> | null;
  participant_account: Record<string, any> | null;
  registration_payment?: Record<string, any> | null;
}

export interface InnerGetAccountsFilter {
  [key: string]: any;
}

export interface InnerPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface InnerPaginatedAccounts {
  items: InnerAccount[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface IAccountPort {
  /** Найти учётную запись. Бросает, если её нет. */
  getAccount(username: string): Promise<InnerAccount>;

  getAccounts(filter: InnerGetAccountsFilter, options?: InnerPaginationOptions): Promise<InnerPaginatedAccounts>;

  /**
   * Человеческое имя для показа: ФИО пайщика или название организации.
   * Служебное учётное имя в интерфейсе показывать нельзя.
   */
  getDisplayName(username: string): Promise<string>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────
/**
 * Учётные записи пайщиков. Провайдер — ядро.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const ACCOUNT_PORT = Symbol.for('Innercoop.CorePort.Account');
