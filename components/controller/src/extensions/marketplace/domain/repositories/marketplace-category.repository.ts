import type { MarketplaceCategoryDomainEntity } from '../entities/marketplace-category.entity';

export const MARKETPLACE_CATEGORY_REPOSITORY = Symbol('MARKETPLACE_CATEGORY_REPOSITORY');

export interface MarketplaceCategoryDomainRepository {
  listBaseline(): Promise<MarketplaceCategoryDomainEntity[]>;
  findById(id: number): Promise<MarketplaceCategoryDomainEntity | null>;
  upsertBaseline(): Promise<void>;
  /**
   * Полный редактируемый список категорий кооператива: общие baseline-категории
   * + собственные кастомные категории данного кооператива, по `sort_order`.
   */
  listForCoop(coopname: string): Promise<MarketplaceCategoryDomainEntity[]>;
  /** Создать кастомную категорию кооператива (mvp_baseline=false). */
  createCustom(coopname: string, displayName: string): Promise<MarketplaceCategoryDomainEntity>;
  /**
   * Удалить кастомную категорию кооператива. Удаляет только собственную
   * (mvp_baseline=false и coopname совпадает); baseline удалить нельзя.
   * Возвращает true, если строка была удалена.
   */
  deleteCustom(coopname: string, id: number): Promise<boolean>;
}
