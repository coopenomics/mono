// domain/appstore/repositories/appstore-domain.repository.interface.ts

import { ExtensionDomainEntity } from '../entities/extension-domain.entity';

export interface ExtensionDomainRepository<TConfig = any> {
  findByName(name: string): Promise<ExtensionDomainEntity<TConfig> | null>;
  deleteByName(name: string): Promise<boolean>;
  create(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>>;
  find(filter?: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>[]>;
  update(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>>;
  /**
   * Атомарно слить частичный патч в JSONB-конфиг расширения.
   *
   * Делает read-merge-write под строчным локом (`SELECT … FOR UPDATE`) в одной
   * транзакции, поэтому конкурентные патчи РАЗНЫХ ключей не затирают друг друга.
   * Это устраняет lost-update, которым страдает `update()`: тот пишет весь
   * `config` целиком из устаревшего снимка, и два почти одновременных писателя
   * (например, два решения совета по разным шагам онбординга) теряют один из
   * результатов — последний writer перезаписывает первого.
   *
   * Возвращает СВЕЖИЙ слитый конфиг. При сериализации лока второй писатель
   * читает уже закоммиченный результат первого, поэтому детекция «все шаги
   * завершены» (allDone / isL1Complete) видит оба флага и не зависает.
   *
   * Слияние ПОВЕРХНОСТНОЕ (top-level ключи). Вложенный объект (например
   * `coopAcceptance`) заменяется целиком — это допустимо, т.к. таким объектом
   * владеет единственный писатель.
   */
  patchConfig(name: string, patch: Record<string, unknown>): Promise<ExtensionDomainEntity<TConfig>>;
}

export const EXTENSION_REPOSITORY = Symbol('ExtensionDomainRepository'); // Создаем уникальный токен
