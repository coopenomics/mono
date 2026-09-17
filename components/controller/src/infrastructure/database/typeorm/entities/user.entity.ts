import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { UserDomainEntity } from '~/domain/user/entities/user-domain.entity';
import type { UserDomainInterface } from '~/domain/user/interfaces/user-domain.interface';
import type { userStatus } from '~/types/user.types';

/**
 * TypeORM сущность для пользователей
 * Хранит пользователей системы в PostgreSQL
 */
@Entity('users')
@Index(['username'], { unique: true }) // Индекс для быстрого поиска по username
@Index(['email'], { unique: true, where: 'email IS NOT NULL' }) // Индекс для поиска по email
@Index(['subscriber_id'], { unique: true, where: "subscriber_id IS NOT NULL AND subscriber_id != ''" }) // Индекс для поиска по subscriber_id
@Index(['status']) // Индекс для поиска по статусу
@Index(['type']) // Индекс для поиска по типу
@Index(['role']) // Индекс для поиска по роли
export class UserEntity implements UserDomainInterface {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: userStatus;

  @Column({ type: 'text', default: '' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  is_registered!: boolean;

  @Column({ type: 'boolean', default: false })
  has_account!: boolean;

  @Column({ type: 'varchar', length: 20 })
  type!: 'individual' | 'entrepreneur' | 'organization';

  @Column({ type: 'text', default: '' })
  public_key!: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  referer!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role!: string;

  @Column({ type: 'boolean', default: false })
  is_email_verified!: boolean;

  @Column({ type: 'varchar', length: 100, default: '' })
  subscriber_id!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  subscriber_hash!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  legacy_mongo_id?: string;

  /**
   * Когда совет принял пайщика (время блока soviet::addpartcpnt). Сама дата
   * живёт в цепи; здесь её копия, чтобы реестр пайщиков сортировался на
   * сервере. Пусто у тех, кого ещё не приняли.
   */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  joined_at?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  constructor(data?: UserDomainEntity) {
    if (data) {
      this.id = data.id;
      this.username = data.username;
      this.status = data.status;
      this.message = data.message;
      this.is_registered = data.is_registered;
      this.has_account = data.has_account;
      this.type = data.type;
      this.public_key = data.public_key;
      this.referer = data.referer;
      this.email = data.email;
      this.role = data.role;
      this.is_email_verified = data.is_email_verified;
      this.subscriber_id = data.subscriber_id;
      this.legacy_mongo_id = data.legacy_mongo_id;
      this.subscriber_hash = data.subscriber_hash;
      this.createdAt = data.createdAt || new Date();
      this.updatedAt = data.updatedAt || new Date();
    }
  }

  /**
   * Преобразует ORM-сущность в доменную сущность
   */
  toDomainEntity(): UserDomainEntity {
    return new UserDomainEntity(
      this.id,
      this.username,
      this.status as any,
      this.message,
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
      this.updatedAt
    );
  }

  /**
   * Создает ORM-сущность из доменной сущности
   */
  static fromDomainEntity(domainEntity: UserDomainEntity): UserEntity {
    return new UserEntity(domainEntity);
  }
}
