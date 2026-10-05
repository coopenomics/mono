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
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    private readonly cycleRepo: MarketplaceConsolidatedRequestDomainRepository,
    @Inject(MARKETPLACE_SHIPMENT_REPOSITORY)
    private readonly shipmentRepo: MarketplaceShipmentDomainRepository,
    @Inject(MARKETPLACE_APL_RECEPTION_REPOSITORY)
    private readonly receptionRepo: MarketplaceAplReceptionDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_CONTAINER_REPOSITORY)
    private readonly containerRepo: MarketplaceContainerDomainRepository,
    @Inject(MARKETPLACE_STORAGE_CELL_REPOSITORY)
    private readonly cellRepo: MarketplaceStorageCellDomainRepository,
    @Inject(MARKETPLACE_RETURN_CLAIM_REPOSITORY)
    private readonly returnClaimRepo: MarketplaceReturnClaimDomainRepository,
    @Inject(MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY)
    private readonly supplierClaimRepo: MarketplaceSupplierClaimDomainRepository,
    @Inject(MARKETPLACE_STOCK_PROPOSAL_REPOSITORY)
    private readonly proposalRepo: MarketplaceStockProposalDomainRepository,
    @Inject(MARKETPLACE_ISSUANCE_SAGA_REPOSITORY)
    private readonly sagaRepo: MarketplaceIssuanceSagaDomainRepository,
    @Inject(MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY)
    private readonly writeoffRepo: MarketplaceWriteoffProposalDomainRepository
  ) {}

  /** Найденные объекты вида `kind` по номерам. */
  async locate(coopname: string, kind: string, ids: string[]): Promise<RightFacts[]> {
    if (!(MARKETPLACE_SUBJECT_KINDS as readonly string[]).includes(kind)) {
      throw new Error(`Справочник объектов Стола заказов не знает вид «${kind}»`);
    }
    const found = await Promise.all(ids.map((id) => this.one(coopname, kind as MarketplaceSubjectKind, id)));
    return found.flat();
  }

  private async one(coopname: string, kind: MarketplaceSubjectKind, id: string): Promise<RightFacts[]> {
    switch (kind) {
      case 'Order': {
        const order = await this.orderRepo.findById(id);
        if (!order || order.coopname !== coopname) return [];
        return [{ owner: order.orderer_account, ku: order.delivery_braname, recipient: order.supplier_account }];
      }
      case 'Offer': {
        const offer = await this.offerRepo.findById(id);
        if (!offer || offer.coopname !== coopname) return [];
        return [{ owner: offer.supplier_account }];
      }
      case 'Cycle': {
        const cycle = await this.cycleRepo.findById(id);
        if (!cycle || cycle.coopname !== coopname) return [];
        return [{ owner: cycle.supplier_account }];
      }
      case 'Shipment': {
        const shipment = await this.shipmentRepo.findById(id);
        if (!shipment || shipment.coopname !== coopname) return [];
        return [{ owner: shipment.offerer_account, ku: shipment.braname }];
      }
      case 'Reception': {
        const reception = await this.receptionRepo.findById(id);
        if (!reception || reception.coopname !== coopname) return [];
        return [{ owner: reception.offerer_account, ku: reception.braname }];
      }
      case 'Inventory': {
        const item = await this.inventoryRepo.findById(id);
        if (!item || item.coopname !== coopname) return [];
        return [{ ku: item.braname }];
      }
      case 'Container': {
        const container = await this.containerRepo.findById(id);
        if (!container || container.coopname !== coopname) return [];
        return [{ ku: container.braname }];
      }
      case 'ContainerCode': {
        // Бокс у стойки находят по коду этикетки, а не по номеру записи.
        const container = await this.containerRepo.findByCode(coopname, id);
        return container ? [{ ku: container.braname }] : [];
      }
      case 'StorageCell': {
        const cell = await this.cellRepo.findById(id);
        if (!cell || cell.coopname !== coopname) return [];
        return [{ ku: cell.braname }];
      }
      case 'ReturnClaim': {
        const claim = await this.returnClaimRepo.findById(id);
        if (!claim || claim.coopname !== coopname) return [];
        return [{ owner: claim.orderer_account, ku: claim.delivery_braname }];
      }
      case 'SupplierClaim': {
        const claim = await this.supplierClaimRepo.findById(id);
        if (!claim || claim.coopname !== coopname) return [];
        return [{ recipient: claim.supplier_account }];
      }
      case 'StockProposal': {
        const proposal = await this.proposalRepo.findById(id);
        if (!proposal || proposal.coopname !== coopname) return [];
        return [{ owner: proposal.member_account, ku: proposal.braname }];
      }
      case 'IssuanceSaga': {
        // Ход выдачи операция называет номером заказа: действующий, а после
        // закрытия — последний по хэшу заказа.
        const active = await this.sagaRepo.findActiveByOrderId(coopname, id);
        if (active) return [{ owner: active.member_account, ku: active.braname }];
        const order = await this.orderRepo.findById(id);
        if (!order || order.coopname !== coopname) return [];
        const last = await this.sagaRepo.findByOrderHash(coopname, order.order_hash);
        return last ? [{ owner: last.member_account, ku: last.braname }] : [];
      }
      case 'WriteoffProposal': {
        // Проект списания собирает позиции нескольких участков: по объекту на участок.
        const proposal = await this.writeoffRepo.findById(id);
        if (!proposal || proposal.coopname !== coopname) return [];
        return [...new Set(proposal.items.map((item) => item.braname))].map((ku) => ({ ku }));
      }
    }
  }
}
