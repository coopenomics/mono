import { userStatus } from '~/types/user.types';

/**
 * Доменная сущность пользователя
 * Представляет пользователя в чистом доменном виде без привязки к конкретной БД
 */
export class UserDomainEntity {
  constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly status: userStatus,
    public readonly message: string,
    public readonly is_registered: boolean,
    public readonly has_account: boolean,
    public readonly type: 'individual' | 'entrepreneur' | 'organization',
    public readonly public_key: string,
    public readonly referer: string,
    public readonly email: string,
    public readonly role: string,
    public readonly is_email_verified: boolean,
    public readonly subscriber_id: string,
    public readonly subscriber_hash: string,
    public readonly legacy_mongo_id?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    /** Фотография пайщика: ключ объекта в хранилище и его тип. */
    public readonly avatar_key?: string | null,
    public readonly avatar_mime?: string | null
  ) {}

  /**
   * Проверяет, является ли пользователь активным
   */
  isActive(): boolean {
    return this.status === userStatus['5_Active'];
  }

  /**
   * Проверяет, заблокирован ли пользователь
   */
  isBlocked(): boolean {
    return this.status === userStatus['200_Blocked'];
  }

  /**
   * Проверяет, подтвержден ли email
   */
  isEmailVerified(): boolean {
    return this.is_email_verified;
  }

  /**
   * Проверяет, имеет ли пользователь аккаунт
   */
  hasBlockchainAccount(): boolean {
    return this.has_account;
  }

  /**
   * Проверяет, зарегистрирован ли пользователь
   */
  isRegistered(): boolean {
    return this.is_registered;
  }

  /**
   * Создает новый экземпляр с обновленным статусом
   */
  withStatus(newStatus: userStatus, message?: string): UserDomainEntity {
    return new UserDomainEntity(
      this.id,
      this.username,
      newStatus,
      message || this.message,
      this.is_registered,
      this.has_account,
      this.type,
      this.public_key,
      this.referer,
      this.email,
      this.role,
      this.is_email_verified,
      this.subscriber_id,
      this.subscriber_hash,
      this.legacy_mongo_id,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Создает новый экземпляр с обновленным email
   */
  withEmail(newEmail: string, isVerified = false): UserDomainEntity {
    return new UserDomainEntity(
      this.id,
      this.username,
      this.status,
      this.message,
      this.is_registered,
      this.has_account,
      this.type,
      this.public_key,
      this.referer,
      newEmail,
      this.role,
      isVerified,
      this.subscriber_id,
      this.subscriber_hash,
      this.legacy_mongo_id,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Создает новый экземпляр с обновленными данными подписчика
   */
  withSubscriber(subscriberId: string, subscriberHash: string): UserDomainEntity {
    return new UserDomainEntity(
      this.id,
      this.username,
      this.status,
      this.message,
      this.is_registered,
      this.has_account,
      this.type,
      this.public_key,
      this.referer,
      this.email,
      this.role,
      this.is_email_verified,
      subscriberId,
      subscriberHash,
      this.legacy_mongo_id,
      this.createdAt,
      new Date()
    );
  }
}
