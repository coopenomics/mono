import type { CategoryEntity } from '../entities/category.entity';

export interface CategoryRepository {
  create(category: Partial<CategoryEntity>): Promise<CategoryEntity>;
  findById(id: string): Promise<CategoryEntity | null>;
  findByCoopname(coopname: string): Promise<CategoryEntity[]>;
  findTree(coopname: string): Promise<CategoryEntity[]>;
  update(id: string, data: Partial<CategoryEntity>): Promise<CategoryEntity>;
  delete(id: string): Promise<void>;
}

export const CATEGORY_REPOSITORY = Symbol('CategoryRepository');
