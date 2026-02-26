import { RequestStatus, type RequestDomainEntity } from './request-domain.entity';

/**
 * Статусы цепочки поставки
 */
export enum DeliveryChainStatus {
  PLANNING = 'planning', // Планируется маршрут
  ACTIVE = 'active', // Активная цепочка
  COMPLETED = 'completed', // Завершена успешно
  FAILED = 'failed', // Провалена
  CANCELLED = 'cancelled', // Отменена
  DISPUTED = 'disputed', // Есть споры в сегментах
}

/**
 * Связанная заявка в цепочке
 */
export class LinkedRequest {
  public readonly requestHash: string; // Хэш заявки
  public readonly blockchainId: string; // ID блокчейна где находится заявка

  constructor(data: { requestHash: string; blockchainId: string }) {
    this.requestHash = data.requestHash;
    this.blockchainId = data.blockchainId;
  }
}

/**
 * Цепочка поставки - связывает заявки для выполнения поставки
 */
export class DeliveryChainDomainEntity {
  public readonly id?: number;

  // Связанные заявки (обычно 2 - поставка и заказ)
  public readonly linkedRequests: RequestDomainEntity[]; // Все заявки в цепочке

  // Временные рамки
  public readonly createdAt: Date;

  constructor(data: { id?: number; status: DeliveryChainStatus; linkedRequests: RequestDomainEntity[]; createdAt?: Date }) {
    this.id = data.id;
    this.linkedRequests = data.linkedRequests;
    this.createdAt = data.createdAt || new Date();
  }

  /**
   * Проверить, завершена ли цепочка
   */
  isCompleted(): boolean {
    return this.linkedRequests.filter((r) => r.status === RequestStatus.COMPLETED).length === this.linkedRequests.length;
  }

  /**
   * Проверить, активна ли цепочка
   */
  isActive(): boolean {
    return this.linkedRequests.filter((r) => r.status === RequestStatus.ACTIVE).length === this.linkedRequests.length;
  }

  /**
   * Проверить, есть ли споры в цепочке
   */
  hasDisputes(): boolean {
    return this.linkedRequests.filter((r) => r.status === RequestStatus.DISPUTED).length > 0;
  }

  /**
   * Получить все хэши заявок
   */
  getAllRequestHashes(): string[] {
    return this.linkedRequests.map((lr) => lr.hash);
  }
}
