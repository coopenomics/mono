import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { SupplyOrderTypeormEntity } from '../entities/supply-order.typeorm-entity';
import type { SupplyOrderRepository, SupplyOrderFilter } from '../../domain/repositories/supply-order.repository';
import type { SupplyOrderEntity } from '../../domain/entities/supply-order.entity';

@Injectable()
export class SupplyOrderTypeormRepository implements SupplyOrderRepository {
  constructor(
    @InjectRepository(SupplyOrderTypeormEntity)
    private readonly repo: Repository<SupplyOrderTypeormEntity>,
  ) {}

  async create(order: Partial<SupplyOrderEntity>): Promise<SupplyOrderEntity> {
    const entity = this.repo.create(order as any);
    return (await this.repo.save(entity)) as unknown as SupplyOrderEntity;
  }

  async findById(id: string): Promise<SupplyOrderEntity | null> {
    return (await this.repo.findOne({ where: { id } })) as unknown as SupplyOrderEntity | null;
  }

  async findByBlockchainHash(hash: string): Promise<SupplyOrderEntity | null> {
    return (await this.repo.findOne({ where: { blockchain_hash: hash } })) as unknown as SupplyOrderEntity | null;
  }

  async findAll(filter: SupplyOrderFilter, page = 1, limit = 20): Promise<{ items: SupplyOrderEntity[]; total: number }> {
    const where: FindOptionsWhere<SupplyOrderTypeormEntity> = {};
    if (filter.coopname) where.coopname = filter.coopname;
    if (filter.supplier_username) where.supplier_username = filter.supplier_username;
    if (filter.customer_username) where.customer_username = filter.customer_username;
    if (filter.status) where.status = filter.status;

    const [items, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { items: items as unknown as SupplyOrderEntity[], total };
  }

  async update(id: string, data: Partial<SupplyOrderEntity>): Promise<SupplyOrderEntity> {
    await this.repo.update(id, data as any);
    return (await this.findById(id))!;
  }
}
