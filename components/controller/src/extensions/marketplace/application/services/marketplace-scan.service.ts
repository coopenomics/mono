import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import {
  encodeMarketplaceHandoffCode,
  MarketplaceHandoffCodeKind,
  parseMarketplaceHandoffCode,
} from '../../domain/marketplace-handoff-code';
import { MarketplaceReturnClaimStatuses } from '../../domain/entities/marketplace-return-claim.types';
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
  MarketplaceHandoffCodeKindDTO,
  MarketplaceScanMatterKind,
  MarketplaceScanTarget,
  type MarketplaceHandoffCodeDTO,
  type MarketplaceScanMatterDTO,
  type MarketplaceScanVisitDTO,
} from '../dto/marketplace-scan.dto';
import { MARKETPLACE_APL_RECEPTION_SERVICE, MarketplaceAplReceptionService } from './marketplace-apl-reception.service';
import { MarketplaceContainerService } from './marketplace-container.service';
import { MARKETPLACE_ORDER_DISPLAY_SERVICE, MarketplaceOrderDisplayService } from './marketplace-order-display.service';

/**
 * Визит на участок по отсканированному коду (задача 598-62). Один сканер на
 * столе ПВЗ: оператор сканирует любой код, сервер отвечает, кто пришёл и какие
 * дела у него на этом участке. Дела перечислены в порядке приоритета: выдать
 * заказы, принять поставку, осмотреть возврат. Код партии и код бокса ведут
 * к предмету, дел у предмета нет.
 */
@Injectable()
export class MarketplaceScanService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_RETURN_CLAIM_REPOSITORY)
    private readonly claimRepo: MarketplaceReturnClaimDomainRepository,
    @Inject(MARKETPLACE_SHIPMENT_REPOSITORY)
    private readonly shipmentRepo: MarketplaceShipmentDomainRepository,
    private readonly containers: MarketplaceContainerService,
    @Inject(MARKETPLACE_APL_RECEPTION_SERVICE)
    private readonly reception: MarketplaceAplReceptionService,
    @Inject(MARKETPLACE_ORDER_DISPLAY_SERVICE)
    private readonly display: MarketplaceOrderDisplayService
  ) {}

  async resolveVisit(coopname: string, braname: string, raw: string): Promise<MarketplaceScanVisitDTO> {
    const code = parseMarketplaceHandoffCode(raw, coopname);
    if (!code) throw DomainError.badRequest('MARKETPLACE_SCAN_CODE_UNRECOGNIZED');
    if (code.coopname !== coopname) throw DomainError.badRequest('MARKETPLACE_SCAN_CODE_WRONG_COOP');

    switch (code.kind) {
      case MarketplaceHandoffCodeKind.Shipment:
        return this.shipmentVisit(coopname, braname, code.ref);
      case MarketplaceHandoffCodeKind.Container:
        return this.containerVisit(coopname, braname, code.ref);
      case MarketplaceHandoffCodeKind.Return:
        return this.returnVisit(coopname, braname, code.ref);
      default:
        return this.personVisit(coopname, braname, code.ref, null);
    }
  }

  /**
   * Код, который пайщик показывает оператору. Сейчас код детерминирован от
   * учётной записи и бессрочен; временные коды второго этапа меняют только
   * этот метод и обратное превращение в `personVisit`.
   */
  handoffCodeFor(coopname: string, account: string, kind: MarketplaceHandoffCodeKindDTO): MarketplaceHandoffCodeDTO {
    const codeKind =
      kind === MarketplaceHandoffCodeKindDTO.PICKUP
        ? MarketplaceHandoffCodeKind.Pickup
        : MarketplaceHandoffCodeKind.Receive;
    return {
      kind,
      code: encodeMarketplaceHandoffCode({ kind: codeKind, coopname, ref: account }),
      expires_at: null,
    };
  }

  private async shipmentVisit(coopname: string, braname: string, shipment_id: string): Promise<MarketplaceScanVisitDTO> {
    const shipment = await this.shipmentRepo.findById(shipment_id);
    if (!shipment || shipment.coopname !== coopname) {
      throw DomainError.notFound('MARKETPLACE_SCAN_SHIPMENT_NOT_FOUND');
    }
    if (shipment.braname !== braname) {
      throw DomainError.badRequest('MARKETPLACE_SCAN_SHIPMENT_OTHER_BRANCH', { braname: shipment.braname });
    }
    return {
      target: MarketplaceScanTarget.SHIPMENT,
      account: null,
      display_name: null,
      matters: [],
      focus_claim_id: null,
      shipment_id: shipment.id,
      container_code: null,
    };
  }

  private async containerVisit(coopname: string, braname: string, code: string): Promise<MarketplaceScanVisitDTO> {
    const container = await this.containers.getByCode(coopname, code);
    if (container.braname !== braname) {
      throw DomainError.badRequest('MARKETPLACE_SCAN_CONTAINER_OTHER_BRANCH', { braname: container.braname });
    }
    return {
      target: MarketplaceScanTarget.CONTAINER,
      account: null,
      display_name: null,
      matters: [],
      focus_claim_id: null,
      shipment_id: null,
      container_code: container.code,
    };
  }

  /** Код заявления ведёт к заявителю: у него на участке могут быть и другие дела. */
  private async returnVisit(coopname: string, braname: string, claim_id: string): Promise<MarketplaceScanVisitDTO> {
    const claim = await this.claimRepo.findById(claim_id);
    if (!claim || claim.coopname !== coopname) {
      throw DomainError.notFound('MARKETPLACE_SCAN_RETURN_CLAIM_NOT_FOUND');
    }
    const awaitsVisitHere =
      claim.delivery_braname === braname &&
      claim.status === MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT;
    return this.personVisit(coopname, braname, claim.orderer_account, awaitsVisitHere ? claim.id : null);
  }

  private async personVisit(
    coopname: string,
    braname: string,
    account: string,
    focus_claim_id: string | null
  ): Promise<MarketplaceScanVisitDTO> {
    const [issuance, pickup, claims, names] = await Promise.all([
      this.orderRepo.listForIssuanceByBraname(coopname, braname),
      this.reception.listSupplierPickupOrders(coopname, braname, account),
      this.claimRepo.listByDeliveryBraname(coopname, braname, MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT),
      this.display.resolveAccountNames([account]),
    ]);
    const matters: MarketplaceScanMatterDTO[] = [];
    const issuanceIds = issuance.filter((o) => o.orderer_account === account).map((o) => o.id);
    if (issuanceIds.length) matters.push({ kind: MarketplaceScanMatterKind.ISSUANCE, ids: issuanceIds });
    const pickupIds = pickup.map((o) => o.id);
    if (pickupIds.length) matters.push({ kind: MarketplaceScanMatterKind.RECEPTION, ids: pickupIds });
    const claimIds = claims.filter((c) => c.orderer_account === account).map((c) => c.id);
    if (claimIds.length) matters.push({ kind: MarketplaceScanMatterKind.RETURN, ids: claimIds });
    return {
      target: MarketplaceScanTarget.PERSON,
      account,
      display_name: names.get(account) ?? null,
      matters,
      focus_claim_id,
      shipment_id: null,
      container_code: null,
    };
  }
}
