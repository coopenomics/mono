/**
 * Учётная запись пайщика в контуре кооператива — та часть, которую видят расширения.
 *
 * Переехал из контроллера вместе с контрактом подписанного документа:
 * зависимостей нет, а расширению путь `~/domain/**` недоступен.
 */
export enum MonoAccountStatus {
  'Created' = 'created',
  'Joined' = 'joined',
  'Payed' = 'payed',
  'Registered' = 'registered',
  'Active' = 'active',
  'Failed' = 'failed',
  'Refunding' = 'refunding',
  'Refunded' = 'refunded',
  'Blocked' = 'blocked',
}

export interface IMonoAccount {
  username: string;
  status: MonoAccountStatus;
  message?: string;
  is_registered: boolean;
  has_account: boolean;
  type: 'individual' | 'entrepreneur' | 'organization';
  public_key: string;
  referer: string;
  email: string;
  role: string;
  is_email_verified: boolean;
  initial_order?: string;
  subscriber_id: string;
  subscriber_hash: string;
}
