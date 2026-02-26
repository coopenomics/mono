import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { RequestType } from './request-domain.entity';

/**
 * Статусы сегмента (соответствуют статусам request в блокчейне)
 */
export enum NetworkSegmentStatus {
  MODERATION = 'moderation', // На модерации
  PUBLISHED = 'published', // Опубликован
  ACCEPTED = 'accepted', // Принят
  AUTHORIZED = 'authorized', // Авторизован
  SUPPLIED1 = 'supplied1', // Поставщик передал товар
  SUPPLIED2 = 'supplied2', // Подтверждена передача
  DELIVERED = 'delivered', // Доставлен
  RECEIVED1 = 'received1', // Заказчик получил товар
  RECEIVED2 = 'received2', // Подтверждено получение
  COMPLETED = 'completed', // Завершен
  DISPUTED = 'disputed', // Спор
  CANCELLED = 'cancelled', // Отменен
  DECLINED = 'declined', // Отклонен
  PROHIBIT = 'prohibit', // Запрещен
  UNPUBLISHED = 'unpublished', // Снят с публикации
}

/**
 * Документы сегмента (из блокчейна)
 */
export class SegmentDocuments {
  public readonly contributeProductStatement?: ISignedDocumentDomainInterface;
  public readonly returnProductStatement?: ISignedDocumentDomainInterface;
  public readonly contributionProductDecisionId?: number;
  public readonly contributionProductAuthorization?: ISignedDocumentDomainInterface;
  public readonly returnProductDecisionId?: number;
  public readonly returnProductAuthorization?: ISignedDocumentDomainInterface;
  public readonly productContributionAct?: ISignedDocumentDomainInterface;
  public readonly productContributionActValidation?: ISignedDocumentDomainInterface;
  public readonly productReceiveAct?: ISignedDocumentDomainInterface;
  public readonly productReceiveActValidation?: ISignedDocumentDomainInterface;

  constructor(
    data: {
      contributeProductStatement?: ISignedDocumentDomainInterface;
      returnProductStatement?: ISignedDocumentDomainInterface;
      contributionProductDecisionId?: number;
      contributionProductAuthorization?: ISignedDocumentDomainInterface;
      returnProductDecisionId?: number;
      returnProductAuthorization?: ISignedDocumentDomainInterface;
      productContributionAct?: ISignedDocumentDomainInterface;
      productContributionActValidation?: ISignedDocumentDomainInterface;
      productReceiveAct?: ISignedDocumentDomainInterface;
      productReceiveActValidation?: ISignedDocumentDomainInterface;
    } = {}
  ) {
    this.contributeProductStatement = data.contributeProductStatement;
    this.returnProductStatement = data.returnProductStatement;
    this.contributionProductDecisionId = data.contributionProductDecisionId;
    this.contributionProductAuthorization = data.contributionProductAuthorization;
    this.returnProductDecisionId = data.returnProductDecisionId;
    this.returnProductAuthorization = data.returnProductAuthorization;
    this.productContributionAct = data.productContributionAct;
    this.productContributionActValidation = data.productContributionActValidation;
    this.productReceiveAct = data.productReceiveAct;
    this.productReceiveActValidation = data.productReceiveActValidation;
  }
}

/**
 * Сегмент сети - соответствует request в блокчейне
 */
export class NetworkSegmentDomainEntity {
  public readonly id?: number;
  public readonly segmentHash: string; // request hash в блокчейне
  public readonly chainId: number; // ID родительской цепочки поставки
  public readonly blockchainId: string; // ID блокчейна где находится сегмент
  public readonly requestHash: string; // Хэш связанной заявки (RequestDomainEntity)

  // Поля из блокчейн request
  public readonly blockchainRequestId?: number; // id в блокчейне
  public readonly parentId?: number; // parent_id
  public readonly programId: number; // program_id
  public readonly coopname: string; // coopname
  public readonly type: RequestType; // type (offer/order)
  public readonly status: NetworkSegmentStatus; // status
  public readonly username: string; // username
  public readonly parentUsername?: string; // parent_username

  // Финансовые поля
  public readonly unitCost: number; // unit_cost
  public readonly supplierAmount: number; // supplier_amount
  public readonly totalCost: number; // total_cost
  public readonly membershipFee: number; // membership_fee
  public readonly currencyCode: string; // из unit_cost

  // Количества
  public readonly remainUnits: number; // remain_units
  public readonly blockedUnits: number; // blocked_units
  public readonly deliveredUnits: number; // delivered_units

  // Участники
  public readonly moneyContributor: string; // money_contributor
  public readonly productContributor: string; // product_contributor

  // Документы
  public readonly documents: SegmentDocuments;

  // Дополнительные данные
  public readonly data?: string; // data
  public readonly meta?: string; // meta

  // Временные рамки
  public readonly productLifecycleSecs?: number; // product_lifecycle_secs
  public readonly cancellationFee?: number; // cancellation_fee (0-100)
  public readonly cancellationFeeAmount?: number; // cancellation_fee_amount

  // Времена (из блокчейна)
  public readonly createdAt: Date; // created_at
  public readonly acceptedAt?: Date; // accepted_at
  public readonly suppliedAt?: Date; // supplied_at
  public readonly deliveredAt?: Date; // delivered_at
  public readonly receivedAt?: Date; // recieved_at
  public readonly completedAt?: Date; // completed_at
  public readonly declinedAt?: Date; // declined_at
  public readonly disputedAt?: Date; // disputed_at
  public readonly cancelledAt?: Date; // canceled_at

  // Гарантийные поля
  public readonly warrantyDelayUntil?: Date; // warranty_delay_until
  public readonly deadlineForReceipt?: Date; // deadline_for_receipt
  public readonly isWarrantyReturn: boolean; // is_warranty_return
  public readonly warrantyReturnId?: number; // warranty_return_id

  constructor(data: {
    id?: number;
    segmentHash: string;
    chainId: number;
    blockchainId: string;
    requestHash: string;
    blockchainRequestId?: number;
    parentId?: number;
    programId: number;
    coopname: string;
    type: RequestType;
    status: NetworkSegmentStatus;
    username: string;
    parentUsername?: string;
    unitCost: number;
    supplierAmount: number;
    totalCost: number;
    membershipFee: number;
    currencyCode: string;
    remainUnits: number;
    blockedUnits: number;
    deliveredUnits: number;
    moneyContributor: string;
    productContributor: string;
    documents?: SegmentDocuments;
    data?: string;
    meta?: string;
    productLifecycleSecs?: number;
    cancellationFee?: number;
    cancellationFeeAmount?: number;
    createdAt?: Date;
    acceptedAt?: Date;
    suppliedAt?: Date;
    deliveredAt?: Date;
    receivedAt?: Date;
    completedAt?: Date;
    declinedAt?: Date;
    disputedAt?: Date;
    cancelledAt?: Date;
    warrantyDelayUntil?: Date;
    deadlineForReceipt?: Date;
    isWarrantyReturn?: boolean;
    warrantyReturnId?: number;
  }) {
    this.id = data.id;
    this.segmentHash = data.segmentHash;
    this.chainId = data.chainId;
    this.blockchainId = data.blockchainId;
    this.requestHash = data.requestHash;
    this.blockchainRequestId = data.blockchainRequestId;
    this.parentId = data.parentId;
    this.programId = data.programId;
    this.coopname = data.coopname;
    this.type = data.type;
    this.status = data.status;
    this.username = data.username;
    this.parentUsername = data.parentUsername;
    this.unitCost = data.unitCost;
    this.supplierAmount = data.supplierAmount;
    this.totalCost = data.totalCost;
    this.membershipFee = data.membershipFee;
    this.currencyCode = data.currencyCode;
    this.remainUnits = data.remainUnits;
    this.blockedUnits = data.blockedUnits;
    this.deliveredUnits = data.deliveredUnits;
    this.moneyContributor = data.moneyContributor;
    this.productContributor = data.productContributor;
    this.documents = data.documents || new SegmentDocuments();
    this.data = data.data;
    this.meta = data.meta;
    this.productLifecycleSecs = data.productLifecycleSecs;
    this.cancellationFee = data.cancellationFee;
    this.cancellationFeeAmount = data.cancellationFeeAmount;
    this.createdAt = data.createdAt || new Date();
    this.acceptedAt = data.acceptedAt;
    this.suppliedAt = data.suppliedAt;
    this.deliveredAt = data.deliveredAt;
    this.receivedAt = data.receivedAt;
    this.completedAt = data.completedAt;
    this.declinedAt = data.declinedAt;
    this.disputedAt = data.disputedAt;
    this.cancelledAt = data.cancelledAt;
    this.warrantyDelayUntil = data.warrantyDelayUntil;
    this.deadlineForReceipt = data.deadlineForReceipt;
    this.isWarrantyReturn = data.isWarrantyReturn || false;
    this.warrantyReturnId = data.warrantyReturnId;
  }

  /**
   * Проверить, завершен ли сегмент
   */
  isCompleted(): boolean {
    return this.status === NetworkSegmentStatus.COMPLETED;
  }

  /**
   * Проверить, активен ли сегмент
   */
  isActive(): boolean {
    return ![NetworkSegmentStatus.COMPLETED, NetworkSegmentStatus.CANCELLED, NetworkSegmentStatus.DECLINED].includes(
      this.status
    );
  }

  /**
   * Проверить, есть ли споры
   */
  hasDisputes(): boolean {
    return this.status === NetworkSegmentStatus.DISPUTED;
  }

  /**
   * Получить общую стоимость
   */
  getTotalValue(): number {
    return this.unitCost * (this.remainUnits + this.blockedUnits + this.deliveredUnits);
  }

  /**
   * Проверить, является ли гарантийным возвратом
   */
  isWarrantyReturnProcess(): boolean {
    return this.isWarrantyReturn;
  }

  /**
   * Проверить, является ли предложением
   */
  isOffer(): boolean {
    return this.type === RequestType.OFFER;
  }

  /**
   * Проверить, является ли заказом
   */
  isOrder(): boolean {
    return this.type === RequestType.ORDER;
  }
}
