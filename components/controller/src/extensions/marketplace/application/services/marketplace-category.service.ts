import { Inject, Injectable } from '@nestjs/common';
import {
  MARKETPLACE_CATEGORY_REPOSITORY,
  type MarketplaceCategoryDomainRepository,
} from '../../domain/repositories/marketplace-category.repository';
import type { MarketplaceCategoryDomainEntity } from '../../domain/entities/marketplace-category.entity';
import { CATEGORY_NAME_TAKEN } from '../../constants/marketplace-category.constants';

export const MARKETPLACE_CATEGORY_SERVICE = Symbol('MARKETPLACE_CATEGORY_SERVICE');

/**
 * Story 3.5: чтение 10 baseline-категорий для фильтр-чипов и формы
 * создания Offer'а (Story 3.2).
 */
@Injectable()
export class MarketplaceCategoryService {
  constructor(
    @Inject(MARKETPLACE_CATEGORY_REPOSITORY)
    private readonly repo: MarketplaceCategoryDomainRepository
  ) {}

  async listBaseline(): Promise<MarketplaceCategoryDomainEntity[]> {
    return this.repo.listBaseline();
  }

  /**
   * Эпик 16: полный редактируемый список категорий кооператива —
   * общие baseline + собственные кастомные категории.
   */
  async listForCoop(coopname: string): Promise<MarketplaceCategoryDomainEntity[]> {
    return this.repo.listForCoop(coopname);
  }

  /**
   * Создать собственную категорию кооператива. Имя обрезается и проверяется
   * на непустоту; название должно быть свободно во всём справочнике —
   * уникальность глобальная, включая категории других кооперативов и baseline.
   *
   * Проверка здесь даёт понятный отказ, а гарантию даёт уникальный индекс:
   * два одновременных запроса проходят проверку оба, и второй падает уже на
   * вставке — репозиторий переводит это в тот же отказ.
   */
  async createCustom(coopname: string, displayName: string): Promise<MarketplaceCategoryDomainEntity> {
    const name = (displayName ?? '').trim();
    if (!name) {
      throw new Error('Название категории не может быть пустым');
    }
    if (await this.repo.existsByDisplayName(name)) {
      throw new Error(CATEGORY_NAME_TAKEN);
    }
    return this.repo.createCustom(coopname, name);
  }

  /**
   * Удалить собственную категорию кооператива. baseline-категории защищены
   * на уровне репозитория (удаляются только строки с coopname кооператива).
   */
  async deleteCustom(coopname: string, id: number): Promise<boolean> {
    return this.repo.deleteCustom(coopname, id);
  }
}
