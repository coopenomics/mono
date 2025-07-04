export enum MonoAccountStatusDomainInterface {
  'Created' = 'created',
  'Joined' = 'joined',
  'Payed' = 'payed',
  'Registered' = 'registered',
  'Active' = 'active',
  'Failed' = 'failed',
  'Refunded' = 'refunded',
  'Blocked' = 'blocked',
}

export interface MonoAccountDomainInterface {
  username: string;
  status: MonoAccountStatusDomainInterface;
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
