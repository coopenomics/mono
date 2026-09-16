import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import {
  LOGGER_PORT,
  type ILoggerPort,
  DOCUMENT_PORT,
  type IDocumentPort,
  type InnerDocumentAggregate,
  USER_WALLET_PORT,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import type { MarketplaceReturnClaimDomainEntity } from '../../domain/entities/marketplace-return-claim.entity';
import type { MarketplaceSupplierClaimDomainEntity } from '../../domain/entities/marketplace-supplier-claim.entity';
import { MarketplaceSupplierClaimStatuses } from '../../domain/entities/marketplace-supplier-claim.types';
import {
  MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY,
  type MarketplaceSupplierClaimDomainRepository,
} from '../../domain/repositories/marketplace-supplier-claim.repository';
import {
  MARKETPLACE_RETURN_CLAIM_REPOSITORY,
  type MarketplaceReturnClaimDomainRepository,
} from '../../domain/repositories/marketplace-return-claim.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import { MarketplaceReturnClaimImagesService } from './marketplace-return-claim-images.service';
import {
  MARKETPLACE_SUPPLIER_CLAIM_ISSUED_EVENT,
  type MarketplaceSupplierClaimIssuedEvent,
} from '../events/marketplace-notification.events';

export const MARKETPLACE_SUPPLIER_CLAIM_SERVICE = Symbol('MARKETPLACE_SUPPLIER_CLAIM_SERVICE');

/** Кошельки ledger2 претензий поставщику — разрез по поставщику (см. wallets.hpp). */
export const SUPPLIER_CLAIM_WALLETS = {
  /** Непризнанные претензии: по умолчанию поставщик не согласен. */
  pending: 'w.mkt.claim',
  /** Признанный долг — гасится удержанием из выплат. */
  debt: 'w.mkt.debt',
} as const;

/**
 * Хэш претензии — как считает контракт в `onmktrtauth`:
 * sha256(32 байта хэша рекламации ‖ "claim"). Своя нитка процесса p.mkt.claim,
 * отличная от нитки возврата по хэшу рекламации.
 */
export function supplierClaimHashOf(request_hash: string): string {
  return createHash('sha256')
    .update(Buffer.concat([Buffer.from(request_hash, 'hex'), Buffer.from('claim', 'utf8')]))
    .digest('hex');
}

export interface MarketplaceSupplierClaimSummary {
  /** Признанный долг, ещё не удержанный из выплат. */
  admitted_debt: string;
  /** Непризнанные претензии — основание для иска. */
  not_admitted_total: string;
  symbol: string;
}

/**
 * Гарантийная претензия поставщику (компонент 68, задача 99D-13).
 *
 * Претензию заводит контракт при исполнении решения совета об отмене сделки
 * (`onmktrtauth`) по заказу с внешним поставщиком; здесь она зеркалится в PG
 * из заявления на возврат, поставщику уходит уведомление. По умолчанию
 * поставщик не согласен — сумма лежит на кошельке непризнанных претензий,
 * кооператив ничего не делает. Признание со стола поставщика — `admit` →
 * `admitclaim` (долг к удержанию из выплат). Несогласие в цепь не пишется:
 * поставщику показываются контакты участка. Сводки по кошелькам читаются из
 * PG-кеша `ledger2::userwallets`.
 */
@Injectable()
export class MarketplaceSupplierClaimService {
  constructor(
    @Inject(MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY)
    private readonly claimRepo: MarketplaceSupplierClaimDomainRepository,
    @Inject(MARKETPLACE_RETURN_CLAIM_REPOSITORY)
    private readonly returnRepo: MarketplaceReturnClaimDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(USER_WALLET_PORT) private readonly userWallets: IUserWalletPort,
    private readonly imagesService: MarketplaceReturnClaimImagesService,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceSupplierClaimService.name);
  }

  // ── Выставление по решению совета ─────────────────────────────────────

  /**
   * Зеркало претензии, которую контракт завёл в `onmktrtauth`. Идемпотентно по
   * хэшу рекламации. По заказу из остатка кооператива претензии нет —
   * поставщик там сам кооператив.
   */
  async issueFromReturnClaim(
    returnClaim: MarketplaceReturnClaimDomainEntity,
    txHash: string
  ): Promise<MarketplaceSupplierClaimDomainEntity | null> {
    if (!returnClaim.supplier_account || returnClaim.supplier_account === returnClaim.coopname) return null;
    const claimHash = supplierClaimHashOf(returnClaim.request_hash);
    const existed = await this.claimRepo.findByClaimHash(returnClaim.coopname, claimHash);
    const claim = await this.claimRepo.createIfNotExists({
      coopname: returnClaim.coopname,
      claim_hash: claimHash,
      return_claim_id: returnClaim.id,
      order_id: returnClaim.order_id,
      order_hash: returnClaim.order_hash,
      supplier_account: returnClaim.supplier_account,
      orderer_account: returnClaim.orderer_account,
      delivery_braname: returnClaim.delivery_braname,
      actual_quantity: returnClaim.actual_quantity,
      amount: returnClaim.fact_cost,
      reason_text: returnClaim.reason_text,
      inspection_result: returnClaim.on_site_inspection?.result_text ?? '',
      photos: returnClaim.photos,
      reclamation: returnClaim.statement,
      issued_at: new Date(),
      issue_tx_hash: txHash,
    });
    if (!existed) {
      const event: MarketplaceSupplierClaimIssuedEvent = {
        coopname: claim.coopname,
        claim_id: claim.id,
        return_claim_id: claim.return_claim_id,
        order_id: claim.order_id,
        supplier_account: claim.supplier_account,
        braname: claim.delivery_braname,
        amount: `${claim.amount} ${this.assetConfig.symbol}`,
        reason_text: claim.reason_text,
        inspection_result: claim.inspection_result,
      };
      this.eventBus.emit(MARKETPLACE_SUPPLIER_CLAIM_ISSUED_EVENT, event);
      this.logger.log(`Претензия поставщику ${claim.supplier_account} на ${event.amount} выставлена по заявлению ${returnClaim.id}.`);
    }
    return claim;
  }

  // ── Чтение ───────────────────────────────────────────────────────────

  async findById(coopname: string, id: string): Promise<MarketplaceSupplierClaimDomainEntity> {
    const claim = await this.claimRepo.findById(id);
    if (!claim || claim.coopname !== coopname) {
      throw new NotFoundException(`Гарантийная претензия ${id} не найдена.`);
    }
    return claim;
  }

  async listBySupplier(coopname: string, supplier: string): Promise<MarketplaceSupplierClaimDomainEntity[]> {
    return this.claimRepo.listBySupplier(coopname, supplier);
  }

  async listAll(coopname: string, supplier?: string): Promise<MarketplaceSupplierClaimDomainEntity[]> {
    return this.claimRepo.listAll(coopname, supplier ? { supplier_account: supplier } : undefined);
  }

  /** Пройденные шаги гарантийного возврата — из журнала решений заявления. */
  async historyOf(claim: MarketplaceSupplierClaimDomainEntity): Promise<MarketplaceReturnClaimDomainEntity | null> {
    return this.returnRepo.findById(claim.return_claim_id);
  }

  async reclamationAggregate(claim: MarketplaceSupplierClaimDomainEntity): Promise<InnerDocumentAggregate | null> {
    if (!claim.reclamation) return null;
    try {
      return await this.documentPort.buildAggregate(claim.reclamation);
    } catch (err) {
      this.logger.warn(`Претензия ${claim.id}: тело рекламации не собрано (${(err as Error).message}).`);
      return null;
    }
  }

  async getPhotoReadUrl(bucketKey: string): Promise<string> {
    return this.imagesService.getReadUrl(bucketKey);
  }

  /**
   * Сводка по кошелькам поставщика: признанный долг к удержанию (`w.mkt.debt`)
   * и непризнанные претензии (`w.mkt.claim`). Отсутствующая запись кошелька —
   * ноль, не ошибка.
   */
  async summary(coopname: string, supplier: string): Promise<MarketplaceSupplierClaimSummary> {
    const read = async (wallet: string): Promise<string> => {
      const row = await this.userWallets.findByWalletAndUsername(coopname, wallet, supplier);
      return this.normalizeAmount(row?.available);
    };
    const [admitted_debt, not_admitted_total] = await Promise.all([
      read(SUPPLIER_CLAIM_WALLETS.debt),
      read(SUPPLIER_CLAIM_WALLETS.pending),
    ]);
    return { admitted_debt, not_admitted_total, symbol: this.assetConfig.symbol };
  }

  // ── Ответ поставщика ─────────────────────────────────────────────────

  async admit(input: { coopname: string; supplier: string; claim_id: string }): Promise<{ claim: MarketplaceSupplierClaimDomainEntity; tx_hash: string }> {
    const claim = await this.requirePendingOwn(input.coopname, input.claim_id, input.supplier);
    const tx = await this.chainPort.admitClaim({
      coopname: claim.coopname,
      supplier: claim.supplier_account,
      claim_hash: claim.claim_hash,
    });
    const txHash = this.extractTxHash(tx);
    const admitted = await this.claimRepo.admit(claim.id, { decided_at: new Date(), decide_tx_hash: txHash });
    this.logger.log(`Претензия ${claim.id}: поставщик ${claim.supplier_account} признал (tx=${txHash}).`);
    return { claim: admitted ?? (await this.findById(input.coopname, input.claim_id)), tx_hash: txHash };
  }

  // ── Зеркало признания из цепи (идемпотентно) ─────────────────────────

  /** Признание, проведённое в цепи, — довести PG до состояния цепи. */
  async mirrorAdmitted(input: { coopname: string; claim_hash: string; tx_hash: string }): Promise<void> {
    const claim = await this.claimRepo.findByClaimHash(input.coopname, input.claim_hash.toLowerCase());
    if (!claim || claim.status !== MarketplaceSupplierClaimStatuses.PENDING) return;
    await this.claimRepo.admit(claim.id, { decided_at: new Date(), decide_tx_hash: input.tx_hash });
  }

  // ── private ──────────────────────────────────────────────────────────

  private async requirePendingOwn(coopname: string, claim_id: string, supplier: string): Promise<MarketplaceSupplierClaimDomainEntity> {
    const claim = await this.findById(coopname, claim_id);
    if (claim.supplier_account !== supplier) {
      throw new ForbiddenException('Отвечать по претензии может только поставщик, которому она выставлена.');
    }
    if (claim.status !== MarketplaceSupplierClaimStatuses.PENDING) {
      throw new ConflictException('Претензия уже признана.');
    }
    return claim;
  }

  private normalizeAmount(value: string | null | undefined): string {
    if (!value) return (0).toFixed(this.assetConfig.decimals);
    const num = Number.parseFloat(String(value).split(' ')[0]);
    return Number.isFinite(num) ? num.toFixed(this.assetConfig.decimals) : (0).toFixed(this.assetConfig.decimals);
  }

  private extractTxHash(tx: unknown): string {
    const candidate = tx as
      | { response?: { transaction_id?: string }; resolved?: { transaction?: { id?: string } }; transaction_id?: string }
      | undefined;
    return String(candidate?.response?.transaction_id ?? candidate?.resolved?.transaction?.id ?? candidate?.transaction_id ?? '');
  }
}
