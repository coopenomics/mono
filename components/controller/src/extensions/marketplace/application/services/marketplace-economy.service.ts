import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Cooperative, type BranchContract } from 'cooptypes';
import { PublicKey, Signature } from '@wharfkit/antelope';
import http from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from './marketplace-ku-chairman.service';
import { rethrowChainError } from '../shared/chain-tx.util';

export const MARKETPLACE_ECONOMY_SERVICE = Symbol('MARKETPLACE_ECONOMY_SERVICE');

/** Контрактная шкала процентов: HUNDR_PERCENTS (1000000) = 100%. */
const HUNDR_PERCENTS = 1_000_000;

/** Контракт-источник распределения в реестре весов branch::weights. */
const MARKETPLACE_SOURCE_CONTRACT = 'marketplace';

export interface MarketplaceTrusteeWeightView {
  username: string;
  weight: number;
  /** Доля в персональном распределении, проценты (вес / Σ весов × 100). */
  share_percent: number;
  /** Баланс персонального кошелька (w.brn.person), asset-строка. */
  personal_balance: string;
}

export interface MarketplaceBranchEconomyView {
  braname: string;
  /** Отсечка персонального распределения, проценты (0 — всё в общий кошелёк). */
  personal_percent: number;
  total_weight: number;
  weights: MarketplaceTrusteeWeightView[];
  /** Баланс общего кошелька КУ (w.brn.common), asset-строка. */
  common_balance: string;
}

/**
 * requirement b6 «Экономика КУ»: единая ставка членского взноса (стол
 * администратора), отсечка и веса распределения (стол ПВЗ, председатель),
 * персональные кошельки доверенных (перевод в «Стол заказов» и
 * материальная помощь).
 *
 * Источник истины конфигурации — on-chain (marketplace::config /
 * marketplace::branchsplits / branch::weights / branch::weighttotals);
 * балансы — ledger2::userwallets. Backend ничего не кеширует в PG —
 * объёмы маленькие, конфигурация меняется редко.
 */
@Injectable()
export class MarketplaceEconomyService {
  constructor(
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly documentDomainService: DocumentDomainService
  ) {}

  // ── Проценты: human (1.5 = 1.5%) ↔ контрактная шкала HUNDR_PERCENTS ──

  private toContractPercent(human: number, label: string): number {
    if (!Number.isFinite(human) || human < 0 || human > 100) {
      throw new BadRequestException(`${label} должна быть в диапазоне от 0 до 100 процентов`);
    }
    return Math.round((human * HUNDR_PERCENTS) / 100);
  }

  private toHumanPercent(contractValue: number | string): number {
    return (Number(contractValue) * 100) / HUNDR_PERCENTS;
  }

  private formatAsset(amount: number): string {
    return `${amount.toFixed(this.assetConfig.decimals)} ${this.assetConfig.symbol}`;
  }

  private zeroAsset(): string {
    return this.formatAsset(0);
  }

  // ── Единая ставка членского взноса ───────────────────────────────────

  async getMembershipFeePercent(coopname: string): Promise<number> {
    const config = await this.chainPort.getEconomyConfig(coopname);
    return config ? this.toHumanPercent(config.membership_fee_percent) : 0;
  }

  async setMembershipFee(coopname: string, feePercentHuman: number): Promise<number> {
    const membership_fee_percent = this.toContractPercent(
      feePercentHuman,
      'Ставка членского взноса'
    );
    try {
      await this.chainPort.setFee({ coopname, membership_fee_percent });
    } catch (e) {
      rethrowChainError(e);
    }
    return this.toHumanPercent(membership_fee_percent);
  }

  // ── Экономика конкретного КУ: отсечка, веса, балансы ─────────────────

  async getBranchEconomy(coopname: string, braname: string): Promise<MarketplaceBranchEconomyView> {
    const [splits, weights, totals, balances] = await Promise.all([
      this.chainPort.getBranchSplits(coopname),
      this.chainPort.getBranchWeights(coopname),
      this.chainPort.getBranchWeightTotals(coopname),
      this.chainPort.listBranchWalletBalances(coopname),
    ]);

    const split = splits.find((s) => s.braname === braname);
    const branchWeights = weights.filter(
      (w) => w.braname === braname && w.contract === MARKETPLACE_SOURCE_CONTRACT
    );
    const total = totals.find(
      (t) => t.braname === braname && t.contract === MARKETPLACE_SOURCE_CONTRACT
    );
    const totalWeight = total ? Number(total.total_weight) : 0;

    const personalBalanceOf = (username: string): string =>
      balances.find((b) => b.wallet_name === 'w.brn.person' && b.username === username)
        ?.available ?? this.zeroAsset();

    const commonBalance =
      balances.find((b) => b.wallet_name === 'w.brn.common' && b.username === braname)
        ?.available ?? this.zeroAsset();

    return {
      braname,
      personal_percent: split ? this.toHumanPercent(split.personal_percent) : 0,
      total_weight: totalWeight,
      weights: branchWeights.map((w) => ({
        username: w.username,
        weight: Number(w.weight),
        share_percent: totalWeight > 0 ? (Number(w.weight) * 100) / totalWeight : 0,
        personal_balance: personalBalanceOf(w.username),
      })),
      common_balance: commonBalance,
    };
  }

  /** Баланс персонального кошелька (w.brn.person) одного доверенного. */
  async getPersonalBalance(coopname: string, username: string): Promise<string> {
    const balances = await this.chainPort.listBranchWalletBalances(coopname);
    return (
      balances.find((b) => b.wallet_name === 'w.brn.person' && b.username === username)
        ?.available ?? this.zeroAsset()
    );
  }

  private async assertIsTrusteeOfBranch(
    coopname: string,
    braname: string,
    username: string
  ): Promise<void> {
    const trustee = await this.kuChairmanService.getTrusteeOfBranch(coopname, braname);
    if (trustee !== username) {
      throw new ForbiddenException(
        'Настройки распределения членских взносов меняет только председатель этого кооперативного участка'
      );
    }
  }

  async setBranchSplit(
    coopname: string,
    initiator: string,
    braname: string,
    personalPercentHuman: number
  ): Promise<void> {
    await this.assertIsTrusteeOfBranch(coopname, braname, initiator);
    const personal_percent = this.toContractPercent(
      personalPercentHuman,
      'Доля персонального распределения'
    );
    try {
      await this.chainPort.setSplit({ coopname, initiator, braname, personal_percent });
    } catch (e) {
      rethrowChainError(e);
    }
  }

  async setTrusteeWeight(
    coopname: string,
    initiator: string,
    braname: string,
    username: string,
    weight: number
  ): Promise<void> {
    await this.assertIsTrusteeOfBranch(coopname, braname, initiator);
    if (!Number.isInteger(weight) || weight <= 0) {
      throw new BadRequestException('Вес должен быть целым числом больше нуля');
    }
    try {
      await this.chainPort.setWeight({
        coopname,
        braname,
        contract: MARKETPLACE_SOURCE_CONTRACT,
        username,
        weight,
      });
    } catch (e) {
      rethrowChainError(e);
    }
  }

  async deleteTrusteeWeight(
    coopname: string,
    initiator: string,
    braname: string,
    username: string
  ): Promise<void> {
    await this.assertIsTrusteeOfBranch(coopname, braname, initiator);
    try {
      await this.chainPort.delWeight({
        coopname,
        braname,
        contract: MARKETPLACE_SOURCE_CONTRACT,
        username,
      });
    } catch (e) {
      rethrowChainError(e);
    }
  }

  // ── Персональные средства доверенного ────────────────────────────────

  async convertBranchFunds(coopname: string, username: string, amount: number): Promise<string> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Сумма перевода должна быть больше нуля');
    }
    const asset = this.formatAsset(amount);
    const convert_hash = createHash('sha256')
      .update(`${coopname}:${username}:convert:${randomBytes(16).toString('hex')}`)
      .digest('hex');
    try {
      await this.chainPort.convertBranchFunds({ coopname, username, convert_hash, amount: asset });
    } catch (e) {
      rethrowChainError(e);
    }
    return asset;
  }

  /**
   * Сформировать подписываемое Заявление на материальную помощь (registry
   * 1109): идентификатор заявки генерится здесь и фиксируется в meta —
   * фронт возвращает его в createAid вместе с подписанным документом.
   */
  async buildAidStatement(
    coopname: string,
    username: string,
    braname: string,
    amount: number
  ): Promise<DocumentDomainEntity> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Сумма материальной помощи должна быть больше нуля');
    }
    const isMember = await this.kuChairmanService.isMemberOfBranch(coopname, braname, username);
    if (!isMember) {
      throw new ForbiddenException(
        'Материальная помощь доступна председателю и доверенным этого кооперативного участка'
      );
    }
    const aid_hash = createHash('sha256')
      .update(`${coopname}:${username}:aid:${randomBytes(16).toString('hex')}`)
      .digest('hex');
    const action: Cooperative.Registry.BranchFinancialAidStatement.Action = {
      registry_id: Cooperative.Registry.BranchFinancialAidStatement.registry_id,
      coopname,
      username,
      lang: 'ru',
      aid_hash,
      braname,
      amount: this.formatAsset(amount),
    };
    return this.documentDomainService.generateDocument({ data: action });
  }

  async createAid(
    coopname: string,
    username: string,
    braname: string,
    amount: number,
    aidHash: string,
    signedStatement: SignedDigitalDocumentInputDTO
  ): Promise<string> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Сумма материальной помощи должна быть больше нуля');
    }
    const isMember = await this.kuChairmanService.isMemberOfBranch(coopname, braname, username);
    if (!isMember) {
      throw new ForbiddenException(
        'Материальная помощь доступна председателю и доверенным этого кооперативного участка'
      );
    }

    this.verifyDocumentSignature(signedStatement, username);
    const meta = signedStatement.meta as
      | { registry_id?: number; aid_hash?: string; amount?: string }
      | undefined;
    if (
      !meta ||
      meta.registry_id !== Cooperative.Registry.BranchFinancialAidStatement.registry_id
    ) {
      throw new BadRequestException(
        `Заявление должно быть зарегистрировано с registry_id=${Cooperative.Registry.BranchFinancialAidStatement.registry_id}`
      );
    }
    if (meta.aid_hash && meta.aid_hash !== aidHash) {
      throw new ConflictException(
        'Заявление подписано для другой заявки — пересоберите Заявление перед отправкой'
      );
    }

    const asset = this.formatAsset(amount);
    const balance = await this.getPersonalBalance(coopname, username);
    if (this.assetToNumber(balance) < amount) {
      throw new BadRequestException(
        `Недостаточно средств на персональном кошельке: доступно ${balance}, запрошено ${asset}`
      );
    }

    try {
      await this.chainPort.createAid({
        coopname,
        username,
        aid_hash: aidHash,
        amount: asset,
        statement: new SignedDigitalDocumentInputDTO(
          signedStatement
        ).toDocument() as BranchContract.Actions.CreateAid.ICreateaid['statement'],
      });
    } catch (e) {
      rethrowChainError(e);
    }
    return asset;
  }

  async listAids(coopname: string, username?: string): Promise<BranchContract.Tables.Aids.IBranchAid[]> {
    const aids = await this.chainPort.listAids(coopname);
    return username ? aids.filter((a) => a.username === username) : aids;
  }

  // ── Внутреннее ────────────────────────────────────────────────────────

  private assetToNumber(asset: string): number {
    return Number(asset.split(' ')[0]);
  }

  private verifyDocumentSignature(
    document: SignedDigitalDocumentInputDTO,
    expectedSigner: string
  ): void {
    const sig = document.signatures?.[0];
    if (!sig) throw new HttpApiError(http.BAD_REQUEST, 'Заявление не подписано');
    if (sig.signer !== expectedSigner) {
      throw new HttpApiError(
        http.BAD_REQUEST,
        'Заявление должно быть подписано самим получателем материальной помощи'
      );
    }
    const publicKey = PublicKey.from(sig.public_key);
    const signature = Signature.from(sig.signature);
    const verified = signature.verifyDigest(sig.signed_hash, publicKey);
    if (!verified) {
      throw new HttpApiError(http.BAD_REQUEST, 'Недействительная подпись Заявления');
    }
  }
}
