import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  contentAsset,
  contentDay,
  contentFact,
  contentMoney,
  processContentRegistry,
  type ProcessContentDTO,
  type ProcessContentProvider,
  type TableStore,
} from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { Ledger2 } from 'cooptypes';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_RETURN_CLAIM_REPOSITORY,
  type MarketplaceReturnClaimDomainRepository,
} from '../../domain/repositories/marketplace-return-claim.repository';
import {
  MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY,
  type MarketplaceWriteoffProposalDomainRepository,
} from '../../domain/repositories/marketplace-writeoff-proposal.repository';
import {
  MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY,
  type MarketplaceSupplierClaimDomainRepository,
} from '../../domain/repositories/marketplace-supplier-claim.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { MARKETPLACE_BRANCH_AID_STORE } from '../../infrastructure/database/marketplace-stores';
import type { MarketplaceBranchAidEntity } from '../../infrastructure/entities/marketplace-branch-aid.entity';
import { MarketplaceOrderDisplayService } from './marketplace-order-display.service';
import { presentSaleUnit } from '../shared/packaging.util';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import { t, te } from '../../i18n';

/** Тип процесса Стола заказов по имени из реестра процессов cooptypes. */
function processTypeOf(name: string): string {
  const meta = Ledger2.LEDGER2_PROCESS_REGISTRY.find((p) => p.contract === 'marketplace' && p.name === name);
  if (!meta) throw new Error(`marketplace: процесс ${name} отсутствует в реестре процессов`); // i18n-ignore
  return meta.type;
}

const SUPPLY = processTypeOf('SUPPLY');
const RETURN = processTypeOf('RETURN');
const WRITEOFF = processTypeOf('WRITEOFF');
const CLAIM = processTypeOf('CLAIM');
const INVEST = processTypeOf('INVEST');
/** Материальная помощь участка: процесс контракта branch, заявление ведёт Стол заказов. */
const AID = Ledger2.LEDGER2_PROCESS_REGISTRY.find((p) => p.contract === 'branch' && p.name === 'AID')?.type ?? 'p.brn.aid'; // i18n-ignore

/** Подпись состояния из словаря; неизвестный код показывается как есть. */
function statusLabel(group: string, code: string | null | undefined): string | null {
  if (!code) return null;
  const key = `marketplace.processContent.${group}.${code}`;
  return te(key) ? t(key) : code;
}

/**
 * Содержание процессов Стола заказов для стола бухгалтера: что за имущество,
 * у кого куплено, кому, на каком участке и в каком состоянии сущность
 * процесса. Учёт (операции, проводки, документы) стол показывает сам.
 */
@Injectable()
export class MarketplaceProcessContentService implements OnModuleInit, ProcessContentProvider {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_RETURN_CLAIM_REPOSITORY)
    private readonly returnRepo: MarketplaceReturnClaimDomainRepository,
    @Inject(MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY)
    private readonly writeoffRepo: MarketplaceWriteoffProposalDomainRepository,
    @Inject(MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY)
    private readonly claimRepo: MarketplaceSupplierClaimDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    @Inject(MARKETPLACE_BRANCH_AID_STORE) private readonly aidStore: TableStore<MarketplaceBranchAidEntity>,
    private readonly display: MarketplaceOrderDisplayService,
    @Inject(MARKETPLACE_ASSET_CONFIG) private readonly assetConfig: MarketplaceAssetConfig
  ) {}

  onModuleInit(): void {
    processContentRegistry.register([SUPPLY, RETURN, WRITEOFF, CLAIM, INVEST, AID], this);
  }

  async content(processHash: string, coopname: string, processType: string): Promise<ProcessContentDTO | null> {
    const hash = processHash.toLowerCase();
    switch (processType) {
      case SUPPLY:
        return this.supply(hash, coopname);
      case RETURN:
        return this.returnClaim(hash, coopname);
      case WRITEOFF:
        return this.writeoff(hash, coopname);
      case CLAIM:
        return this.supplierClaim(hash, coopname);
      case INVEST:
        return this.investProperty(hash, coopname);
      case AID:
        return this.branchAid(hash, coopname);
      default:
        return null;
    }
  }

  /** Поставка: хэш процесса — хэш заказа. */
  private async supply(hash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const order = await this.orderRepo.findByOrderHash(coopname, hash);
    if (!order) return null;
    const card = await this.orderCard(order);
    return {
      ...card,
      amount: this.asset(order.total_cost),
      amount_label: t('marketplace.processContent.supply.amountLabel'),
      status: statusLabel('orderStatus', order.status),
      facts: [
        ...card.facts,
        ...contentFact(t('marketplace.processContent.blockedAt'), contentDay(order.blocked_at)),
        ...contentFact(t('marketplace.processContent.acceptedAt'), contentDay(order.accepted_at)),
        ...contentFact(t('marketplace.processContent.receivedAt'), contentDay(order.received_at)),
        ...contentFact(t('marketplace.processContent.warrantyUntil'), contentDay(order.warranty_until)),
      ],
    };
  }

  /** Гарантийный возврат: хэш процесса — хэш заявления о возврате. */
  private async returnClaim(hash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const claim = await this.returnRepo.findByRequestHash(coopname, hash);
    if (!claim) return null;
    const order = await this.orderRepo.findById(claim.order_id);
    const card = order ? await this.orderCard(order, claim.actual_quantity) : null;
    return {
      title: card?.title ?? t('marketplace.processContent.untitledProduct'),
      subtitle: card?.subtitle ?? null,
      image_url: card?.image_url ?? null,
      amount: this.asset(claim.fact_cost),
      amount_label: t('marketplace.processContent.return.amountLabel'),
      status: statusLabel('returnStatus', claim.status),
      facts: [
        ...(card?.facts ?? []),
        ...contentFact(t('marketplace.processContent.return.reason'), claim.reason_text),
        ...contentFact(t('marketplace.processContent.return.defect'), statusLabel('defect', claim.defect_category)),
      ],
      links: card?.links ?? [],
    };
  }

  /** Утилизация скоропорта: хэш процесса — хэш предложения о списании. */
  private async writeoff(hash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const proposal = await this.writeoffRepo.findByHash(coopname, hash);
    if (!proposal) return null;
    const items = proposal.items.map((item) => item.asset_title).filter(Boolean);
    const branches = [...new Set(proposal.items.map((item) => item.braname))];
    return {
      title: items.length
        ? t('marketplace.processContent.writeoff.title', { items: items.slice(0, 3).join(', '), more: Math.max(items.length - 3, 0) })
        : t('marketplace.processContent.writeoff.titleEmpty'),
      subtitle: t('marketplace.processContent.writeoff.positions', { count: proposal.items.length }),
      image_url: null,
      amount: this.asset(proposal.total_amount),
      amount_label: t('marketplace.processContent.writeoff.amountLabel'),
      status: statusLabel('writeoffStatus', proposal.status),
      facts: [
        ...contentFact(t('marketplace.processContent.branch'), (await Promise.all(branches.map((b) => this.branchLabel(b)))).join(', ')),
        ...proposal.items.map((item) => ({
          label: item.asset_title,
          value: t('marketplace.processContent.writeoff.itemValue', { quantity: item.quantity, amount: this.money(item.amount) }),
        })),
        ...contentFact(t('marketplace.processContent.writeoff.submittedAt'), contentDay(proposal.submitted_at)),
        ...contentFact(t('marketplace.processContent.writeoff.authorizedAt'), contentDay(proposal.authorized_at)),
        ...contentFact(t('marketplace.processContent.writeoff.executedAt'), contentDay(proposal.executed_at)),
        ...contentFact(t('marketplace.processContent.writeoff.rejectReason'), proposal.reject_reason),
      ],
      links: [],
    };
  }

  /** Гарантийная претензия поставщику: хэш процесса — хэш рекламации. */
  private async supplierClaim(hash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const claim = await this.claimRepo.findByClaimHash(coopname, hash);
    if (!claim) return null;
    const order = await this.orderRepo.findById(claim.order_id);
    const card = order ? await this.orderCard(order, claim.actual_quantity) : null;
    return {
      title: card?.title ?? t('marketplace.processContent.untitledProduct'),
      subtitle: card?.subtitle ?? null,
      image_url: card?.image_url ?? null,
      amount: this.asset(claim.amount),
      amount_label: t('marketplace.processContent.claim.amountLabel'),
      status: statusLabel('claimStatus', claim.status),
      facts: [
        ...(card?.facts ?? []),
        ...contentFact(t('marketplace.processContent.return.reason'), claim.reason_text),
        ...contentFact(t('marketplace.processContent.claim.inspection'), claim.inspection_result),
        ...contentFact(t('marketplace.processContent.claim.issuedAt'), contentDay(claim.issued_at)),
        ...contentFact(t('marketplace.processContent.claim.decidedAt'), contentDay(claim.decided_at)),
      ],
      links: card?.links ?? [],
    };
  }

  /**
   * Паевой взнос инициатора имуществом: хэш процесса — хэш заявления. Строку
   * заявления контракт держит до акта приёма; после акта карточки нет, учёт
   * и документы процесса остаются на столе.
   */
  private async investProperty(hash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const prop = await this.chainPort.getInvestProperty(coopname, hash);
    if (!prop) return null;
    return {
      title: prop.description || t('marketplace.processContent.untitledProduct'),
      subtitle: null,
      image_url: null,
      amount: contentAsset(String(prop.amount), this.assetConfig.symbol, this.assetConfig.decimals),
      amount_label: t('marketplace.processContent.invest.amountLabel'),
      status: statusLabel('investStatus', String(prop.status)),
      facts: [
        ...contentFact(t('marketplace.processContent.invest.initiator'), await this.nameOf(String(prop.username))),
        ...contentFact(t('marketplace.processContent.branch'), await this.branchLabel(String(prop.braname))),
        ...contentFact(t('marketplace.processContent.invest.createdAt'), contentDay(String(prop.created_at))),
      ],
      links: [],
    };
  }

  /** Материальная помощь участка: хэш процесса — хэш заявления. */
  private async branchAid(hash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const aid = await this.aidStore.findOne({ coopname, aid_hash: hash });
    if (!aid) return null;
    const recipient = await this.nameOf(aid.username);
    return {
      title: recipient,
      subtitle: null,
      image_url: null,
      amount: this.asset(aid.amount),
      amount_label: t('marketplace.processContent.aid.amountLabel'),
      status: statusLabel('aidStatus', aid.status),
      facts: [
        ...contentFact(t('marketplace.processContent.branch'), await this.branchLabel(aid.braname)),
        ...contentFact(t('marketplace.processContent.aid.createdAt'), contentDay(aid.created_at)),
        ...contentFact(t('marketplace.processContent.aid.paidAt'), contentDay(aid.paid_at)),
      ],
      links: [],
    };
  }

  /** Общая часть карточки заказа: имущество, количество, стороны, участок, цена. */
  private async orderCard(order: MarketplaceOrderDomainEntity, quantity?: number): Promise<ProcessContentDTO> {
    const view = await this.display.enrichOne(order, { withGroupProgress: false, withParticipantNames: true });
    const unit = presentSaleUnit(Number(quantity ?? order.quantity), order.unit_of_measure, order.package_size);
    const branch = view.delivery_point_name
      ? t('marketplace.processContent.branchValue', { name: view.delivery_point_name, braname: order.delivery_braname })
      : order.delivery_braname;
    return {
      title: view.product_name || t('marketplace.processContent.untitledProduct'),
      subtitle: `${unit.units} ${unit.unitLabel}`.trim(),
      image_url: view.image_url ?? null,
      amount: null,
      amount_label: null,
      status: null,
      facts: [
        ...contentFact(t('marketplace.processContent.supplier'), view.supplier_name || order.supplier_account),
        ...contentFact(t('marketplace.processContent.orderer'), view.orderer_name || order.orderer_account),
        ...contentFact(t('marketplace.processContent.branch'), branch),
        ...contentFact(
          t('marketplace.processContent.pricePerUnit'),
          t('marketplace.processContent.priceValue', { price: this.money(order.price_per_unit), unit: unit.unitLabel })
        ),
      ],
      links: [{ label: t('marketplace.processContent.openOrder'), path: `/market-admin/orders/${order.id}` }],
    };
  }

  /** Сумма Стола заказов активом «10000.0000 RUB». */
  private asset(amount: string | null | undefined): string | null {
    return contentAsset(amount, this.assetConfig.symbol, this.assetConfig.decimals);
  }

  /** Сумма словами «100,00 RUB». */
  private money(amount: string | null | undefined): string {
    return contentMoney(amount, this.assetConfig.symbol);
  }

  /** ФИО пайщика или название организации; без имени — учётное имя. */
  private async nameOf(account: string): Promise<string> {
    return (await this.accountPort.getDisplayName(account)) || account;
  }

  /** Участок словами: «РОМАШКА» (pobswpilmjob). */
  private async branchLabel(braname: string): Promise<string> {
    const name = await this.accountPort.getDisplayName(braname);
    return name && name !== braname ? t('marketplace.processContent.branchValue', { name, braname }) : braname;
  }
}
