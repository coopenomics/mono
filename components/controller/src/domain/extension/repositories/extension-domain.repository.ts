// domain/appstore/repositories/appstore-domain.repository.interface.ts

import { ExtensionDomainEntity } from '../entities/extension-domain.entity';

export interface ExtensionDomainRepository<TConfig = any> {
  findByName(name: string): Promise<ExtensionDomainEntity<TConfig> | null>;
  deleteByName(name: string): Promise<boolean>;
  create(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>>;
  find(filter?: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>[]>;
  update(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>>;
  /**
   * Атомарно мёржит `patch` в jsonb-колонку `config` одним UPDATE (`config || patch`),
   * без чтения-изменения-записи всего объекта в памяти приложения. Конкурентные вызовы
   * с разными ключами patch не теряют изменения друг друга (в отличие от `update()`,
   * который перезаписывает весь config целиком и подвержен lost update при гонке).
   */
  patchConfig(name: string, patch: Partial<TConfig>): Promise<ExtensionDomainEntity<TConfig>>;
}

export const EXTENSION_REPOSITORY = Symbol('ExtensionDomainRepository'); // Создаем уникальный токен
