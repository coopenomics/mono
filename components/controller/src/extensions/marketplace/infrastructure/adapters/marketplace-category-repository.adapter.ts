import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MarketplaceCategoryDomainRepository } from '../../domain/repositories/marketplace-category.repository';
import {
  MARKETPLACE_FOOD_CATEGORIES,
  MarketplaceCategoryDomainEntity,
} from '../../domain/entities/marketplace-category.entity';
import { MarketplaceCategoryEntity } from '../entities/marketplace-category.entity';
import { MarketplaceCategoryMapper } from '../mappers/marketplace-category.mapper';
import {
  CATEGORY_NAME_TAKEN,
  UX_CATEGORY_DISPLAY_NAME,
} from '../../constants/marketplace-category.constants';

/** Сколько раз пересчитываем номер при проигранной гонке за MAX(id)+1. */
const CREATE_ATTEMPTS = 3;

/** Код нарушения уникальности в PostgreSQL. */
const PG_UNIQUE_VIOLATION = '23505';

const violatedConstraint = (e: unknown): string | null => {
  const driver = (e as { driverError?: { code?: string; constraint?: string } })?.driverError;
  if (driver?.code !== PG_UNIQUE_VIOLATION) return null;
  return driver.constraint ?? '';
};

const isDisplayNameConflict = (e: unknown): boolean =>
  violatedConstraint(e) === UX_CATEGORY_DISPLAY_NAME;

const isPrimaryKeyConflict = (e: unknown): boolean => {
  const constraint = violatedConstraint(e);
  return constraint !== null && constraint !== UX_CATEGORY_DISPLAY_NAME;
};

@Injectable()
export class MarketplaceCategoryRepositoryAdapter
  implements MarketplaceCategoryDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceCategoryEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceCategoryEntity>,
    private readonly mapper: MarketplaceCategoryMapper
  ) {}

  async listBaseline(): Promise<MarketplaceCategoryDomainEntity[]> {
    const rows = await this.repo.find({
      where: { mvp_baseline: true },
      order: { sort_order: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async findById(id: number): Promise<MarketplaceCategoryDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async upsertBaseline(): Promise<void> {
    for (const c of MARKETPLACE_FOOD_CATEGORIES) {
      await this.repo.upsert(
        { id: c.id, display_name: c.display_name, sort_order: c.sort_order, mvp_baseline: true },
        ['id']
      );
    }
  }

  async listForCoop(coopname: string): Promise<MarketplaceCategoryDomainEntity[]> {
    const rows = await this.repo.find({
      where: [{ mvp_baseline: true }, { coopname }],
      order: { sort_order: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async existsByDisplayName(displayName: string): Promise<boolean> {
    // Регистронезависимо и по всему справочнику: имя категории уникально
    // глобально, а не в пределах кооператива. Условие повторяет выражение
    // уникального индекса `ux_marketplace_category_display_name_lower`,
    // иначе проверка и индекс разойдутся.
    const found = await this.repo
      .createQueryBuilder('c')
      .where('lower(c.display_name) = lower(:name)', { name: displayName })
      .getCount();
    return found > 0;
  }

  async createCustom(
    coopname: string,
    displayName: string
  ): Promise<MarketplaceCategoryDomainEntity> {
    // Идентификатор считается как MAX(id)+1, поэтому две одновременные вставки
    // претендуют на один и тот же номер: проигравшая падает на первичном ключе.
    // Это не конфликт имён, а гонка нумерации — её пересчитываем и повторяем.
    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
      // baseline занимает фиксированные id 1..9; кастомные нумеруем поверх максимума.
      // sort_order также наследует максимум — новая категория уходит в конец списка.
      const max = await this.repo
        .createQueryBuilder('c')
        .select('MAX(c.id)', 'maxId')
        .addSelect('MAX(c.sort_order)', 'maxSort')
        .getRawOne<{ maxId: number | null; maxSort: number | null }>();

      const nextId = Number(max?.maxId ?? 0) + 1;
      const nextSort = Number(max?.maxSort ?? 0) + 1;

      const row = this.repo.create({
        id: nextId,
        display_name: displayName,
        sort_order: nextSort,
        mvp_baseline: false,
        coopname,
      });

      try {
        const saved = await this.repo.save(row);
        return this.mapper.toDomain(saved);
      } catch (e) {
        if (isDisplayNameConflict(e)) {
          // Второй запрос с тем же названием прошёл проверку сервиса и упёрся
          // в индекс — отказ тот же, что и при проверке.
          throw new Error(CATEGORY_NAME_TAKEN);
        }
        if (!isPrimaryKeyConflict(e) || attempt === CREATE_ATTEMPTS - 1) {
          throw e;
        }
      }
    }
    throw new Error(CATEGORY_NAME_TAKEN);
  }

  async deleteCustom(coopname: string, id: number): Promise<boolean> {
    // Удаляем только собственную кастомную строку кооператива; baseline (coopname IS NULL)
    // под условие не подпадает и остаётся нетронутым.
    const res = await this.repo.delete({ id, coopname, mvp_baseline: false });
    return (res.affected ?? 0) > 0;
  }
}
