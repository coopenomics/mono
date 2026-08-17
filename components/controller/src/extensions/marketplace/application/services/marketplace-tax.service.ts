import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { BranchContract } from 'cooptypes';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import { rethrowChainError } from '../shared/chain-tx.util';
import {
  getTaxTransferRequisites,
  type TaxTransferRequisites,
} from '@coopenomics/jurisdictions';
import {
  ORGANIZATION_PORT,
  PAYMENT_DESK_PORT,
  PaymentStatus,
  PaymentType,
  type IOrganizationPort,
  type IPaymentDeskPort,
  type InnerSystemOutgoingPaymentInput,
} from '@coopenomics/innercoop';

/** Кошелёк удержанного НДФЛ — его остаток и есть долг кооператива перед бюджетом. */
const NDFL_WALLET = 'w.brn.ndfl';

/** Что бухгалтер видит в разделе налогов. */
export interface MarketplaceTaxView {
  /** Удержано и ещё не перечислено — остаток кошелька `w.brn.ndfl`. */
  withheld: string;
  /** Уже отправлено на оплату и ждёт подтверждения кассиром. */
  in_payment: string;
  /** Доступно к отправке: удержано за вычетом того, что уже у кассира. */
  available: string;
}

/**
 * Перечисление удержанного НДФЛ в бюджет (requirement b6, решение владельца
 * 2026-08-13).
 *
 * Удерживая налог с материальной помощи, кооператив копит обязательство перед
 * бюджетом: деньги остаются на расчётном счёте, а долг виден как остаток
 * кошелька `w.brn.ndfl`. Гасится он не по каждой выплате, а единым налоговым
 * платежом — так налоги и платятся: одной суммой на счёт налоговой, с
 * последующим уведомлением о том, как её разнести.
 *
 * Поэтому здесь ровно два действия: показать бухгалтеру, сколько удержано и
 * сколько уже в пути к кассиру, и отправить сумму на оплату. Больше
 * удержанного отправить нельзя — контракт это и проверяет, но отсекать надо
 * раньше, чтобы бухгалтер увидел причину, а не отказ цепи.
 */
@Injectable()
export class MarketplaceTaxService {
  private readonly logger = new Logger(MarketplaceTaxService.name);

  constructor(
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    @Inject(PAYMENT_DESK_PORT)
    private readonly coreGateway: IPaymentDeskPort,
    @Inject(ORGANIZATION_PORT)
    private readonly orgRepo: IOrganizationPort
  ) {}

  /**
   * Реквизиты бюджета на сегодня для страны кооператива. Страна берётся из
   * профиля организации, а не подразумевается: платить налог одинаково во всех
   * странах нельзя, а справочник для неизвестной страны честно молчит.
   */
  private async loadTaxRequisites(coopname: string): Promise<TaxTransferRequisites | null> {
    let country: string | null = null;
    try {
      country = (await this.orgRepo.findByUsername(coopname))?.country ?? null;
    } catch (e) {
      this.logger.warn(
        `Не удалось определить страну кооператива ${coopname}: ` +
          `${e instanceof Error ? e.message : String(e)}`
      );
    }
    return getTaxTransferRequisites(country, new Date());
  }

  private formatAsset(amount: number): string {
    return `${amount.toFixed(this.assetConfig.decimals)} ${this.assetConfig.symbol}`;
  }

  private assetToNumber(asset: string | null | undefined): number {
    if (!asset) return 0;
    const parsed = Number.parseFloat(asset.split(' ')[0] ?? '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * Сколько налога удержано, сколько уже отправлено кассиру и сколько можно
   * отправить сейчас.
   *
   * «В пути» считается по заявкам на цепи (`branch::taxes`), а не по
   * core-платежам: заявка живёт ровно от отправки до подтверждения кассиром,
   * и её сумма ещё сидит в остатке кошелька — иначе бухгалтер отправил бы те
   * же деньги дважды.
   */
  async getTaxState(coopname: string): Promise<MarketplaceTaxView> {
    const [walletBalance, pending] = await Promise.all([
      this.chainPort.getCooperativeWalletBalance(coopname, NDFL_WALLET),
      this.chainPort.listTaxPayments(coopname),
    ]);

    const withheld = this.assetToNumber(walletBalance);
    const inPayment = pending.reduce((sum, row) => sum + this.assetToNumber(row.amount), 0);

    return {
      withheld: this.formatAsset(withheld),
      in_payment: this.formatAsset(inPayment),
      available: this.formatAsset(Math.max(0, withheld - inPayment)),
    };
  }

  /**
   * Отправить удержанный налог на оплату: заявка появляется у кассира в
   * реестре исходящих платежей, он платит по реквизитам налоговой и
   * подтверждает — тогда обязательство закрывается (`o.brn.taxpay`).
   *
   * Платёж создаётся сразу видимым кассиру (PENDING): решение совета здесь не
   * требуется, перечисление удержанного налога — обязанность налогового
   * агента, а не распоряжение средствами кооператива.
   */
  async createTaxPayment(coopname: string, amount: number): Promise<string> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Сумма платежа должна быть больше нуля');
    }

    const state = await this.getTaxState(coopname);
    const available = this.assetToNumber(state.available);
    if (amount > available) {
      throw new BadRequestException(
        `Доступно к перечислению ${state.available}: перечислить можно не больше удержанного, ` +
          `а ${state.in_payment} уже отправлено кассиру и ждёт подтверждения`
      );
    }

    const asset = this.formatAsset(amount);
    const taxHash = createHash('sha256')
      .update(`${coopname}:tax:${randomBytes(16).toString('hex')}`)
      .digest('hex');

    // Core-платёж создаётся до отправки на цепь — кассиру нужна заявка, даже
    // если цепь ответит не сразу. Получателем платежа стоит сам кооператив:
    // деньги уходят в бюджет, пайщика-получателя здесь нет.
    const requisites = await this.loadTaxRequisites(coopname);
    try {
      await this.coreGateway.createSystemOutgoingPayment({
        coopname,
        username: coopname,
        quantity: amount,
        symbol: this.assetConfig.symbol,
        memo: requisites?.memo ?? 'Перечисление удержанного НДФЛ',
        type: PaymentType.TAX,
        status: PaymentStatus.PENDING,
        related_extension: 'marketplace',
        related_entity_id: taxHash,
        payment_hash: taxHash,
        ...this.budgetPaymentDetails(asset, requisites),
      });
    } catch (e: any) {
      throw new BadRequestException(
        `Не удалось зарегистрировать платёж в реестре: ${e.message}. Заявка не создана, повторите попытку.`
      );
    }

    try {
      await this.chainPort.createTaxPayment({
        coopname,
        tax_hash: taxHash,
        amount: asset,
        meta: JSON.stringify({ kind: 'ndfl', amount: asset }),
      } as BranchContract.Actions.CreateTax.ICreatetax);
    } catch (e) {
      // Заявка на цепь не встала — гасим core-платёж, иначе кассир заплатит
      // по заявке, которой на цепи нет, и подтверждение не найдёт запись.
      await this.cancelTaxPayment(coopname, taxHash);
      rethrowChainError(e);
    }

    this.logger.log(`Налоговый платёж ${taxHash.slice(0, 8)}: отправлено на оплату ${asset}`);
    return asset;
  }

  /**
   * Реквизиты бюджета снимком в деталях платежа. Платёжного метода у такой
   * выплаты нет — реквизиты налоговой не принадлежат никому из пайщиков, а
   * кассиру они нужны в карточке платежа, а не в его памяти. Для страны, чьи
   * реквизиты системе неизвестны, деталей нет: заявка всё равно создаётся, и
   * кассир заполняет платёжку сам, как делал раньше.
   */
  private budgetPaymentDetails(
    asset: string,
    requisites: TaxTransferRequisites | null
  ): Pick<InnerSystemOutgoingPaymentInput, 'payment_details'> | Record<string, never> {
    if (!requisites) return {};
    return {
      payment_details: {
        data: {
          recipient_name: requisites.recipientName,
          requisite_rows: requisites.rows,
        },
        amount_plus_fee: asset,
        amount_without_fee: asset,
        fee_amount: '0',
        fee_percent: 0,
        fact_fee_percent: 0,
        tolerance_percent: 0,
      },
    };
  }

  /** Отменить core-платёж, если заявка не дошла до цепи. */
  private async cancelTaxPayment(coopname: string, taxHash: string): Promise<void> {
    try {
      const found = await this.coreGateway.getPayments(
        { coopname, hash: taxHash },
        { page: 1, limit: 1, sortOrder: 'DESC' }
      );
      const payment = found.items[0];
      if (payment?.id) {
        await this.coreGateway.setPaymentStatus({
          id: payment.id,
          status: PaymentStatus.CANCELLED,
          message: 'Заявку на перечисление налога не удалось зарегистрировать',
        });
      }
    } catch (e: any) {
      // Гашение — лучшее усилие: исходная ошибка цепи важнее и уже летит наверх.
      this.logger.warn(`Не удалось отменить платёж ${taxHash.slice(0, 8)}: ${e.message}`);
    }
  }
}
