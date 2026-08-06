import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  MarketplaceContainerDomainEntity,
  MarketplaceContainerTypeDomainEntity,
} from '../../domain/entities/marketplace-container.entity';
import {
  computeVolumeLiters,
  parseContainerCodeSequence,
} from '../../domain/entities/marketplace-container.types';
import type {
  MarketplaceContainerCreateInput,
  MarketplaceContainerDomainRepository,
  MarketplaceContainerListFilter,
  MarketplaceContainerPatch,
  MarketplaceContainerTypeCreateInput,
  MarketplaceContainerTypeDomainRepository,
  MarketplaceContainerTypePatch,
} from '../../domain/repositories/marketplace-container.repository';
import {
  MarketplaceContainerEntity,
  MarketplaceContainerTypeEntity,
} from '../entities/marketplace-container.entity';
import {
  MarketplaceContainerMapper,
  MarketplaceContainerTypeMapper,
} from '../mappers/marketplace-container.mapper';

@Injectable()
export class MarketplaceContainerTypeRepositoryAdapter implements MarketplaceContainerTypeDomainRepository {
  constructor(
    @InjectRepository(MarketplaceContainerTypeEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceContainerTypeEntity>,
    private readonly mapper: MarketplaceContainerTypeMapper
  ) {}

  async create(input: MarketplaceContainerTypeCreateInput): Promise<MarketplaceContainerTypeDomainEntity> {
    const name = input.name.trim();
    const duplicate = await this.repo.findOne({ where: { coopname: input.coopname, name } });
    if (duplicate) {
      throw new ConflictException(`Тип боксов «${name}» уже заведён.`);
    }
    const row = this.repo.create({
      coopname: input.coopname,
      name,
      length_mm: input.length_mm,
      width_mm: input.width_mm,
      height_mm: input.height_mm,
      volume_liters:
        input.volume_liters ?? computeVolumeLiters(input.length_mm, input.width_mm, input.height_mm),
      max_weight_kg: input.max_weight_kg ?? null,
      is_active: true,
    });
    return this.mapper.toDomain(await this.repo.save(row));
  }

  async findById(id: string): Promise<MarketplaceContainerTypeDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(coopname: string, is_active?: boolean): Promise<MarketplaceContainerTypeDomainEntity[]> {
    const where: Record<string, unknown> = { coopname };
    if (is_active !== undefined) where.is_active = is_active;
    const rows = await this.repo.find({ where, order: { name: 'ASC' } });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async update(
    id: string,
    patch: MarketplaceContainerTypePatch
  ): Promise<MarketplaceContainerTypeDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) return null;
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.volume_liters !== undefined) row.volume_liters = patch.volume_liters;
    if (patch.max_weight_kg !== undefined) row.max_weight_kg = patch.max_weight_kg;
    if (patch.is_active !== undefined) row.is_active = patch.is_active;
    return this.mapper.toDomain(await this.repo.save(row));
  }
}

@Injectable()
export class MarketplaceContainerRepositoryAdapter implements MarketplaceContainerDomainRepository {
  constructor(
    @InjectRepository(MarketplaceContainerEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceContainerEntity>,
    private readonly mapper: MarketplaceContainerMapper
  ) {}

  async createBatch(
    inputs: readonly MarketplaceContainerCreateInput[]
  ): Promise<MarketplaceContainerDomainEntity[]> {
    if (inputs.length === 0) return [];
    const rows = inputs.map((input) =>
      this.repo.create({
        coopname: input.coopname,
        braname: input.braname,
        code: input.code.trim(),
        label: input.label ?? null,
        container_type_id: input.container_type_id,
        cell_id: input.cell_id ?? null,
        is_active: true,
      })
    );
    const saved = await this.repo.save(rows);
    return saved.map((row) => this.mapper.toDomain(row));
  }

  async findById(id: string): Promise<MarketplaceContainerDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByCode(coopname: string, code: string): Promise<MarketplaceContainerDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, code: code.trim() } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(filter: MarketplaceContainerListFilter): Promise<MarketplaceContainerDomainEntity[]> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.braname !== undefined) {
      where.braname = Array.isArray(filter.braname) ? In(filter.braname) : filter.braname;
    }
    if (filter.is_active !== undefined) where.is_active = filter.is_active;
    if (filter.container_type_id !== undefined) where.container_type_id = filter.container_type_id;
    if (filter.unplaced_only) where.cell_id = IsNull();
    else if (filter.cell_id !== undefined) where.cell_id = filter.cell_id;

    const rows = await this.repo.find({ where, order: { code: 'ASC' } });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async update(
    id: string,
    patch: MarketplaceContainerPatch
  ): Promise<MarketplaceContainerDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) return null;
    if (patch.label !== undefined) row.label = patch.label;
    if (patch.is_active !== undefined) row.is_active = patch.is_active;
    if (patch.cell_id !== undefined) row.cell_id = patch.cell_id;
    return this.mapper.toDomain(await this.repo.save(row));
  }

  async countByCell(coopname: string, cell_id: string): Promise<number> {
    return this.repo.count({ where: { coopname, cell_id, is_active: true } });
  }

  async maxCodeSequence(coopname: string): Promise<number> {
    const rows = await this.repo.find({ where: { coopname }, select: ['code'] });
    return rows.reduce((max, row) => {
      const sequence = parseContainerCodeSequence(row.code);
      return sequence !== null && sequence > max ? sequence : max;
    }, 0);
  }
}
