import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryTypeormEntity } from '../entities/category.typeorm-entity';
import type { CategoryRepository } from '../../domain/repositories/category.repository';
import type { CategoryEntity } from '../../domain/entities/category.entity';

@Injectable()
export class CategoryTypeormRepository implements CategoryRepository {
  constructor(
    @InjectRepository(CategoryTypeormEntity)
    private readonly repo: Repository<CategoryTypeormEntity>,
  ) {}

  async create(category: Partial<CategoryEntity>): Promise<CategoryEntity> {
    const entity = this.repo.create(category as any);
    return (await this.repo.save(entity)) as unknown as CategoryEntity;
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    return (await this.repo.findOne({ where: { id } })) as unknown as CategoryEntity | null;
  }

  async findByCoopname(coopname: string): Promise<CategoryEntity[]> {
    return (await this.repo.find({ where: { coopname }, order: { sort_order: 'ASC' } })) as unknown as CategoryEntity[];
  }

  async findTree(coopname: string): Promise<CategoryEntity[]> {
    return this.findByCoopname(coopname);
  }

  async update(id: string, data: Partial<CategoryEntity>): Promise<CategoryEntity> {
    await this.repo.update(id, data as any);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
