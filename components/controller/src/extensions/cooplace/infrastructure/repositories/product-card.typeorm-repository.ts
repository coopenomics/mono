import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { ProductCardTypeormEntity } from '../entities/product-card.typeorm-entity';
import type { ProductCardRepository, ProductCardFilter } from '../../domain/repositories/product-card.repository';
import type { ProductCardEntity } from '../../domain/entities/product-card.entity';

@Injectable()
export class ProductCardTypeormRepository implements ProductCardRepository {
  constructor(
    @InjectRepository(ProductCardTypeormEntity)
    private readonly repo: Repository<ProductCardTypeormEntity>,
  ) {}

  async create(card: Partial<ProductCardEntity>): Promise<ProductCardEntity> {
    const entity = this.repo.create(card as any);
    const saved = await this.repo.save(entity);
    return saved as unknown as ProductCardEntity;
  }

  async findById(id: string): Promise<ProductCardEntity | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity as unknown as ProductCardEntity | null;
  }

  async findAll(filter: ProductCardFilter, page = 1, limit = 20): Promise<{ items: ProductCardEntity[]; total: number }> {
    const where: FindOptionsWhere<ProductCardTypeormEntity> = {};
    if (filter.coopname) where.coopname = filter.coopname;
    if (filter.username) where.username = filter.username;
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    if (filter.category_id) where.category_id = filter.category_id;
    if (filter.search) where.title = Like(`%${filter.search}%`);

    const [items, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { items: items as unknown as ProductCardEntity[], total };
  }

  async update(id: string, data: Partial<ProductCardEntity>): Promise<ProductCardEntity> {
    await this.repo.update(id, data as any);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
