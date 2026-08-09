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

  async createCustom(
    coopname: string,
    displayName: string
  ): Promise<MarketplaceCategoryDomainEntity> {
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
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async deleteCustom(coopname: string, id: number): Promise<boolean> {
    // Удаляем только собственную кастомную строку кооператива; baseline (coopname IS NULL)
    // под условие не подпадает и остаётся нетронутым.
    const res = await this.repo.delete({ id, coopname, mvp_baseline: false });
    return (res.affected ?? 0) > 0;
  }
}
