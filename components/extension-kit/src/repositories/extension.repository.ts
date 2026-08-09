import { ExtensionDomainEntity } from '../entities/extension.entity';

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

/**
 * DI-токен репозитория расширений. Реализацию подставляет ядро контроллера.
 *
 * `Symbol.for`, а не `Symbol()`: расширение и ядро резолвят токен из своих копий пакета,
 * и совпасть они обязаны по глобальному реестру символов, иначе DI молча не найдёт провайдера.
 */
export const EXTENSION_REPOSITORY = Symbol.for('ExtensionKit.Repository.Extension');
