import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { MarketContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord, type ISignedDocument } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { MARKETPLACE_RETURN_CLAIM_SERVICE, MarketplaceReturnClaimService } from './marketplace-return-claim.service';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';

/** Статус заявки на цепи, когда взнос ждёт пополнения общего кошелька участка (`ReturnStatus::FEE_PENDING`). */
const CHAIN_FEE_PENDING_STATUS = 'feepend';

/**
 * Слушатель обратных вызовов совета по гарантийному возврату (паевая модель)
 * и сторож ожидания решения.
 *
 * Заявление уходит в совет через `marketplace::accretrn` (инлайн повестка
 * `mktretrn`). После решения `soviet::exec` вызывает `marketplace::onmktrtauth`
 * (все движения по заказу откачены) либо `onmktrtdecl` (отказ / просрочка).
 * Слушатель переводит заявление дальше; сторож раз в 30 секунд дочитывает
 * номер решения и зовёт робота там, где это не удалось у стойки. Решение
 * людей сторож не торопит — оно может идти сколь угодно долго.
 *
 * Если общий кошелёк участка к решению совета был уже распределён, контракт
 * исполняет решение без взноса и оставляет заявку на цепи в `feepend`
 * (задача 99D-15): слушатель читает заявку с цепи и отмечает ожидание в
 * проекции; `payretfee` (крон повтора) снимает отметку.
 */
@Injectable()
export class MarketplaceReturnClaimSyncService {
  private static readonly WATCHDOG_MS = 30_000;
  private ticking = false;

  constructor(
    @Inject(MARKETPLACE_RETURN_CLAIM_SERVICE)
    private readonly returnService: MarketplaceReturnClaimService,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceReturnClaimSyncService.name);
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.OnMktRtAuth.actionName}`)
  async handleAuthorized(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.OnMktRtAuth.IOnMktRtAuth;
      if (!data?.coopname || !data?.hash) return;
      // On-chain hash приходит в верхнем регистре, request_hash в проекции — в нижнем.
      const request_hash = String(data.hash).toLowerCase();
      const tx_hash = this.txHash(action);
      await this.returnService.onCouncilAuthorized({
        coopname: data.coopname,
        request_hash,
        protocol: (data.authorization as unknown as ISignedDocument) ?? null,
        tx_hash,
      });
      if (await this.feeAwaitsBranchTopUp(data.coopname, request_hash)) {
        await this.returnService.markFeeRefundPending({ coopname: data.coopname, request_hash, tx_hash });
      }
    } catch (err: any) {
      this.logger.error(`onmktrtauth listener упал: ${err.message}`, err.stack);
    }
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.PayRetFee.actionName}`)
  async handleFeeSettled(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.PayRetFee.IPayRetFee;
      if (!data?.coopname || !data?.request_hash) return;
      await this.returnService.onFeeRefundSettled({
        coopname: data.coopname,
        request_hash: String(data.request_hash).toLowerCase(),
        tx_hash: this.txHash(action),
      });
    } catch (err: any) {
      this.logger.error(`payretfee listener упал: ${err.message}`, err.stack);
    }
  }

  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.OnMktRtDecl.actionName}`)
  async handleDeclined(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.OnMktRtDecl.IOnMktRtDecl;
      if (!data?.coopname || !data?.hash) return;
      await this.returnService.onCouncilDeclined({
        coopname: data.coopname,
        request_hash: String(data.hash).toLowerCase(),
        reason: data.reason ?? 'причина не указана',
        tx_hash: this.txHash(action),
      });
    } catch (err: any) {
      this.logger.error(`onmktrtdecl listener упал: ${err.message}`, err.stack);
    }
  }

  @Interval(MarketplaceReturnClaimSyncService.WATCHDOG_MS)
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.returnService.watchdogTick(platformSettings().coopname);
    } catch (err: any) {
      this.logger.warn(`Сторож возврата: проход упал (${err.message}).`);
    } finally {
      this.ticking = false;
    }
  }

  /**
   * После решения совета заявка на цепи либо стёрта (взнос вернулся), либо
   * ждёт пополнения кошелька участка. Сбой чтения цепи ожиданием не считается:
   * крон повтора всё равно ничего не сделает без отметки, а отметить ложно
   * значит слать `payretfee` по закрытой заявке.
   */
  private async feeAwaitsBranchTopUp(coopname: string, request_hash: string): Promise<boolean> {
    try {
      const row = await this.chainPort.findReturnRequestByHash(coopname, request_hash);
      return !!row && String(row.status).toLowerCase() === CHAIN_FEE_PENDING_STATUS;
    } catch (err: any) {
      this.logger.warn(`onmktrtauth: заявка ${request_hash} с цепи не прочитана (${err.message}) — ожидание взноса не отмечено.`);
      return false;
    }
  }

  private txHash(action: InnerChainActionRecord): string {
    return action.transaction_id ?? '';
  }
}
