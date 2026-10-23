import { Inject, Injectable } from '@nestjs/common';
import type { RightFacts } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_APL_RECEPTION_REPOSITORY,
  type MarketplaceAplReceptionDomainRepository,
} from '../../domain/repositories/marketplace-apl-reception.repository';
import {
  MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
  type MarketplaceConsolidatedRequestDomainRepository,
} from '../../domain/repositories/marketplace-consolidated-request.repository';
import {
  MARKETPLACE_CONTAINER_REPOSITORY,
  type MarketplaceContainerDomainRepository,
} from '../../domain/repositories/marketplace-container.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MARKETPLACE_ISSUANCE_SAGA_REPOSITORY,
  type MarketplaceIssuanceSagaDomainRepository,
} from '../../domain/repositories/marketplace-issuance-saga.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_RETURN_CLAIM_REPOSITORY,
  type MarketplaceReturnClaimDomainRepository,
} from '../../domain/repositories/marketplace-return-claim.repository';
import {
  MARKETPLACE_SHIPMENT_REPOSITORY,
  type MarketplaceShipmentDomainRepository,
} from '../../domain/repositories/marketplace-shipment.repository';
import {
  MARKETPLACE_STOCK_PROPOSAL_REPOSITORY,
  type MarketplaceStockProposalDomainRepository,
} from '../../domain/repositories/marketplace-stock-proposal.repository';
import {
  MARKETPLACE_STORAGE_CELL_REPOSITORY,
  type MarketplaceStorageCellDomainRepository,
} from '../../domain/repositories/marketplace-storage-cell.repository';
import {
  MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY,
  type MarketplaceSupplierClaimDomainRepository,
} from '../../domain/repositories/marketplace-supplier-claim.repository';
import {
  MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY,
  type MarketplaceWriteoffProposalDomainRepository,
} from '../../domain/repositories/marketplace-writeoff-proposal.repository';

/**
 * Виды объектов Стола заказов, которые операция называет источником сверки
 * охвата: `@RequireRight('Issuance', 'create', { of: 'Order', id: 'data.order_id' })`.
 */
export const MARKETPLACE_SUBJECT_KINDS = [
  'Order',
  'Offer',
  'Cycle',
  'Shipment',
  'Reception',
  'Inventory',
  'Container',
  'ContainerCode',
  'StorageCell',
  'ReturnClaim',
  'SupplierClaim',
  'StockProposal',
  'IssuanceSaga',
  'WriteoffProposal',
] as const;

export type MarketplaceSubjectKind = (typeof MARKETPLACE_SUBJECT_KINDS)[number];

/** Поиск объектов одного вида по номеру: найденные и своего кооператива. */
type Locator = (coopname: string, id: string) => Promise<RightFacts[]>;

/** Объект хранилища по номеру записи. */
function byId<E extends { coopname: string }>(
  repo: { findById(id: string): Promise<E | null> },
  facts: (entity: E) => RightFacts
): Locator {
  return async (coopname, id) => {
    const entity = await repo.findById(id);
    return entity && entity.coopname === coopname ? [facts(entity)] : [];
  };
}

/**
 * Справочник объектов Стола заказов для сверки охвата прав (C28-87).
 *
 * Отвечает на один вопрос: кто владелец объекта, чей это участок и кому
 * объект направлен. Правило охвата по этим трём полям записано в каркасе
 * расширений один раз; до 05.10.2026 каждую сверку писал свой резолвер или
 * сервис. Объекта нет или он чужого кооператива — в ответе его нет:
 * «не найдено» отвечает сама операция.
 */
@Injectable()
export class MarketplaceRightSubjects {
  private readonly locators: Record<MarketplaceSubjectKind, Locator>;

  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    cycleRepo: MarketplaceConsolidatedRequestDomainRepository,
    @Inject(MARKETPLACE_SHIPMENT_REPOSITORY)
    shipmentRepo: MarketplaceShipmentDomainRepository,
    @Inject(MARKETPLACE_APL_RECEPTION_REPOSITORY)
    receptionRepo: MarketplaceAplReceptionDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_CONTAINER_REPOSITORY)
    private readonly containerRepo: MarketplaceContainerDomainRepository,
    @Inject(MARKETPLACE_STORAGE_CELL_REPOSITORY)
    cellRepo: MarketplaceStorageCellDomainRepository,
    @Inject(MARKETPLACE_RETURN_CLAIM_REPOSITORY)
    returnClaimRepo: MarketplaceReturnClaimDomainRepository,
    @Inject(MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY)
    supplierClaimRepo: MarketplaceSupplierClaimDomainRepository,
    @Inject(MARKETPLACE_STOCK_PROPOSAL_REPOSITORY)
    proposalRepo: MarketplaceStockProposalDomainRepository,
    @Inject(MARKETPLACE_ISSUANCE_SAGA_REPOSITORY)
    private readonly sagaRepo: MarketplaceIssuanceSagaDomainRepository,
    @Inject(MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY)
    private readonly writeoffRepo: MarketplaceWriteoffProposalDomainRepository
  ) {
    this.locators = {
      Order: byId(orderRepo, (order) => ({
        owner: order.orderer_account,
        ku: order.delivery_braname,
        recipient: order.supplier_account,
      })),
      Offer: byId(offerRepo, (offer) => ({ owner: offer.supplier_account })),
      Cycle: byId(cycleRepo, (cycle) => ({ owner: cycle.supplier_account })),
      Shipment: byId(shipmentRepo, (shipment) => ({ owner: shipment.offerer_account, ku: shipment.braname })),
      Reception: byId(receptionRepo, (reception) => ({ owner: reception.offerer_account, ku: reception.braname })),
      Inventory: byId(inventoryRepo, (item) => ({ ku: item.braname })),
      Container: byId(containerRepo, (container) => ({ ku: container.braname })),
      ContainerCode: (coopname, code) => this.containerByCode(coopname, code),
      StorageCell: byId(cellRepo, (cell) => ({ ku: cell.braname })),
      ReturnClaim: byId(returnClaimRepo, (claim) => ({ owner: claim.orderer_account, ku: claim.delivery_braname })),
      SupplierClaim: byId(supplierClaimRepo, (claim) => ({ recipient: claim.supplier_account })),
      StockProposal: byId(proposalRepo, (proposal) => ({ owner: proposal.member_account, ku: proposal.braname })),
      IssuanceSaga: (coopname, order_id) => this.sagaOfOrder(coopname, order_id),
      WriteoffProposal: (coopname, id) => this.writeoffBranches(coopname, id),
    };
  }

  /** Найденные объекты вида `kind` по номерам. */
  async locate(coopname: string, kind: string, ids: string[]): Promise<RightFacts[]> {
    const locator = this.locators[kind as MarketplaceSubjectKind];
    if (!locator) {
      // i18n-ignore: ошибка разработчика — вид объекта назван в декораторе операции, пайщик этот текст не видит
      throw new Error(`Справочник объектов Стола заказов не знает вид «${kind}»`);
    }
    const found = await Promise.all(ids.map((id) => locator(coopname, id)));
    return found.flat();
  }

  /** Бокс у стойки находят по коду этикетки, а не по номеру записи. */
  private async containerByCode(coopname: string, code: string): Promise<RightFacts[]> {
    const container = await this.containerRepo.findByCode(coopname, code);
    return container ? [{ ku: container.braname }] : [];
  }

  /**
   * Ход выдачи операция называет номером заказа: действующий, а после
   * закрытия — последний по хэшу заказа.
   */
  private async sagaOfOrder(coopname: string, order_id: string): Promise<RightFacts[]> {
    const active = await this.sagaRepo.findActiveByOrderId(coopname, order_id);
    if (active) return [{ owner: active.member_account, ku: active.braname }];
    const order = await this.orderRepo.findById(order_id);
    if (!order || order.coopname !== coopname) return [];
    const last = await this.sagaRepo.findByOrderHash(coopname, order.order_hash);
    return last ? [{ owner: last.member_account, ku: last.braname }] : [];
  }

  /** Проект списания собирает позиции нескольких участков: по объекту на участок. */
  private async writeoffBranches(coopname: string, id: string): Promise<RightFacts[]> {
    const proposal = await this.writeoffRepo.findById(id);
    if (!proposal || proposal.coopname !== coopname) return [];
    return [...new Set(proposal.items.map((item) => item.braname))].map((ku) => ({ ku }));
  }
}
