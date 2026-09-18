import type { userStatus } from '~/types/user.types';

/**
 * Основной доменный интерфейс пользователя
 */
export interface UserDomainInterface {
  id: string;
  username: string;
  status: userStatus;
  message: string;
  is_registered: boolean;
  has_account: boolean;
  type: 'individual' | 'entrepreneur' | 'organization';
  public_key: string;
  referer: string;
  email: string;
  role: string;
  is_email_verified: boolean;
  subscriber_id: string;
  subscriber_hash: string;
  legacy_mongo_id?: string;
  /** Ключ фотографии в хранилище и её тип; пусто — фотографии нет. */
  avatar_key?: string | null;
  avatar_mime?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
