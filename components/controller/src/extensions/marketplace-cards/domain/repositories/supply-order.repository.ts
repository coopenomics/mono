import type { SupplyOrderEntity, SupplyOrderStatus } from '../entities/supply-order.entity';

export interface SupplyOrderFilter {
  coopname?: string;
  supplier_username?: string;
  customer_username?: string;
  status?: SupplyOrderStatus;
}

export interface SupplyOrderRepository {
  create(order: Partial<SupplyOrderEntity>): Promise<SupplyOrderEntity>;
  findById(id: string): Promise<SupplyOrderEntity | null>;
  findByBlockchainHash(hash: string): Promise<SupplyOrderEntity | null>;
  findAll(filter: SupplyOrderFilter, page?: number, limit?: number): Promise<{ items: SupplyOrderEntity[]; total: number }>;
  update(id: string, data: Partial<SupplyOrderEntity>): Promise<SupplyOrderEntity>;
}

export const SUPPLY_ORDER_REPOSITORY = Symbol('SupplyOrderRepository');
