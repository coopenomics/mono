import type { ProductCardEntity, ProductCardStatus, ProductCardType } from '../entities/product-card.entity';

export interface ProductCardFilter {
  coopname?: string;
  username?: string;
  type?: ProductCardType;
  status?: ProductCardStatus;
  category_id?: string;
  search?: string;
}

export interface ProductCardRepository {
  create(card: Partial<ProductCardEntity>): Promise<ProductCardEntity>;
  findById(id: string): Promise<ProductCardEntity | null>;
  findAll(filter: ProductCardFilter, page?: number, limit?: number): Promise<{ items: ProductCardEntity[]; total: number }>;
  update(id: string, data: Partial<ProductCardEntity>): Promise<ProductCardEntity>;
  delete(id: string): Promise<void>;
}

export const PRODUCT_CARD_REPOSITORY = Symbol('ProductCardRepository');
