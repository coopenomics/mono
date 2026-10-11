import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import {
  HANDOFF_CODE_TTL_HOURS,
  isAccountName,
  MarketplaceHandoffCodeKind,
  parseMarketplaceHandoffCode,
  TOKEN_LENGTH,
  tokenFromBytes,
} from '../../domain/marketplace-handoff-code';
import {
  MARKETPLACE_HANDOFF_CODE_REPOSITORY,
  type MarketplaceHandoffCodeDomainRepository,
} from '../../domain/repositories/marketplace-handoff-code.repository';
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
    @Inject(MARKETPLACE_HANDOFF_CODE_REPOSITORY)
    private readonly codes: MarketplaceHandoffCodeDomainRepository,
    private readonly containers: MarketplaceContainerService,
    @Inject(MARKETPLACE_APL_RECEPTION_SERVICE)
    private readonly reception: MarketplaceAplReceptionService,
    @Inject(MARKETPLACE_ORDER_DISPLAY_SERVICE)
    private readonly display: MarketplaceOrderDisplayService
  ) {}

  async resolveVisit(coopname: string, braname: string, raw: string, now: Date = new Date()): Promise<MarketplaceScanVisitDTO> {
    const code = parseMarketplaceHandoffCode(raw, coopname);
    if (!code) throw DomainError.badRequest('MARKETPLACE_SCAN_CODE_UNRECOGNIZED');
    if (code.coopname !== coopname) throw DomainError.badRequest('MARKETPLACE_SCAN_CODE_WRONG_COOP');

    if (code.kind === 'token') {
      const issued = await this.codes.findByToken(coopname, code.ref);
      // Код не из таблицы — это мог быть логин прописными: пробуем как ручной ввод.
      if (!issued) return this.manualVisit(coopname, braname, raw);
      if (issued.expires_at.getTime() <= now.getTime()) {
        throw DomainError.badRequest('MARKETPLACE_SCAN_CODE_EXPIRED');
      }
      return this.personVisit(coopname, braname, issued.account, null);
    }

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
   * Код, который пайщик показывает оператору: случайный, живёт сутки, один на
   * учётную запись. Пока код действует, сервер отдаёт его же; по истечении
   * выдаёт новый. Вид (получение / приёмка) на содержимое не влияет — дела на
   * участке сервер собирает по учётной записи.
   */
  async handoffCodeFor(
    coopname: string,
    account: string,
    kind: MarketplaceHandoffCodeKindDTO,
    now: Date = new Date()
  ): Promise<MarketplaceHandoffCodeDTO> {
    const live = await this.codes.findLiveByAccount(coopname, account, now);
    if (live) return { kind, code: live.token, expires_at: live.expires_at };
    const created = await this.codes.create({
      coopname,
      account,
      token: tokenFromBytes(randomBytes(TOKEN_LENGTH)),
      expires_at: new Date(now.getTime() + HANDOFF_CODE_TTL_HOURS * 60 * 60 * 1000),
    });
    return { kind, code: created.token, expires_at: created.expires_at };
  }

  /** Строка, похожая на код пайщика, но не из таблицы: логин прописными либо мусор. */
  private async manualVisit(coopname: string, braname: string, raw: string): Promise<MarketplaceScanVisitDTO> {
    const login = raw.trim().toLowerCase();
    if (!isAccountName(login)) throw DomainError.badRequest('MARKETPLACE_SCAN_CODE_UNRECOGNIZED');
    return this.personVisit(coopname, braname, login, null);
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
