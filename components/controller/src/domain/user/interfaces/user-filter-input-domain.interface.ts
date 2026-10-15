import type { userStatus } from '~/types/user.types';

/**
 * Интерфейс фильтра для поиска пользователей
 */
export interface UserFilterInputDomainInterface {
  username?: string;
  email?: string;
  status?: userStatus;
  type?: 'individual' | 'entrepreneur' | 'organization';
  role?: string;
  is_email_verified?: boolean;
  has_account?: boolean;
  is_registered?: boolean;
  subscriber_id?: string;
  created_from?: Date;
  created_to?: Date;
  /** Только эти аккаунты (отбор, посчитанный вне базы, например по цепи). */
  usernames?: string[];
}
