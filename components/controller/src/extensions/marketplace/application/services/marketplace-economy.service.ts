import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { registerEnumType } from '@nestjs/graphql';
import { createHash, randomBytes } from 'crypto';
import { Cooperative, type BranchContract } from 'cooptypes';
import { PublicKey, Signature } from '@wharfkit/antelope';
import http from 'http-status';
import { LEDGER2_HISTORY_PORT, type ILedger2HistoryPort, type InnerLedger2HistoryResult, EXPENSE_CHASSIS_PORT, type IExpenseChassisPort, DOCUMENT_PORT, type IDocumentPort, type InnerGeneratedDocument } from '@coopenomics/innercoop';
import { PaymentStatus, PaymentType } from '@coopenomics/innercoop';
import { SignedDigitalDocumentInputDTO, PaginationInputDTO, type PaginationResult, HttpApiError } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from './marketplace-ku-chairman.service';
import { rethrowChainError } from '../shared/chain-tx.util';
import { formatPayoutDestination } from '../shared/payout-destination.util';
import {
  EXPENSE_PLANS_SERVICE,
  EXPENSE_RESERVE_HORIZON_DAYS,
  type ExpensePlansService,
} from '../../../expenses/application/services/expense-plans.service';
import {
  GATEWAY_INTERACTOR_PORT,
  type GatewayInteractorPort,
} from '~/domain/wallet/ports/gateway-interactor.port';
import {
  PAYMENT_METHOD_REPOSITORY,
  type PaymentMethodRepository,
} from '~/domain/common/repositories/payment-method.repository';
import { type CreateBranchExpenseInputDTO } from '../dto/branch-expense.dto';
import { ExpenseMechanics } from '../../../expenses/domain/enums/expense-mechanics.enum';
import { ExpenseRecipientType } from '../../../expenses/domain/enums/expense-recipient-type.enum';

/** Значение `aids.status` на цепи, означающее «совет одобрил, ждёт выплаты». */
const BRANCH_AID_STATUS_AUTHORIZED = 'authorized';

export const MARKETPLACE_ECONOMY_SERVICE = Symbol('MARKETPLACE_ECONOMY_SERVICE');

/** Контрактная шкала процентов: HUNDR_PERCENTS (1000000) = 100%. */
const HUNDR_PERCENTS = 1_000_000;

/**
 * Дефолт ставки членского взноса нового кооператива — 30% в контрактной
 * шкале, зеркалит `DEFAULT_MEMBERSHIP_FEE_PERCENT` из marketplace.hpp.
 * Пока singleton `config` не создан on-chain (кооператив ещё не вызывал
 * `setfee`), И контракт (расчёт взноса при заказе), И бэкенд (зеркальный
 * расчёт суммы конвертации для чекаута) обязаны согласованно использовать
 * один и тот же дефолт — иначе сумма в чекауте разойдётся с фактическим
 * списанием on-chain.
 */
const DEFAULT_MEMBERSHIP_FEE_PERCENT = 300_000;

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
  total_weight: number;
  weights: MarketplaceTrusteeWeightView[];
  /** Баланс общего кошелька КУ (w.brn.common), asset-строка. */
  common_balance: string;
  /** Плановый резерв расходов ближайших 30 дней, asset-строка. */
  reserve_amount: string;
  /** Доступно к распределению: общий кошелёк минус резерв, asset-строка. */
  available_to_distribute: string;
}

/** Одно движение по общему кошельку КУ (`w.brn.common`) — только apply-записи ledger2 (несут operation_code + memo). */
export interface MarketplaceBranchWalletOperationView {
  global_sequence: string;
  operation_code: string;
  quantity: string | null;
  memo: string | null;
  /** Хэш заказа-источника (order_hash из p.mkt.supply) — адресация в реестр заказов КУ. Null для движений без заказа (распределение, оплата расхода). */
  order_hash: string | null;
  /** Идентификатор заказа-источника — прямая ссылка на страницу заказа. Null, если движение не связано с заказом. */
  order_id: string | null;
  created_at: Date;
}

/** Стадия заявления на материальную помощь. */
export enum MarketplaceAidStage {
  /** Заявление подписано и внесено на рассмотрение совета. */
  ON_COUNCIL = 'ON_COUNCIL',
  /** Совет одобрил выплату — заявка передана кассиру. */
  AWAITING_PAYOUT = 'AWAITING_PAYOUT',
}

registerEnumType(MarketplaceAidStage, {
  name: 'MarketplaceAidStage',
  description: 'Стадия заявления на материальную помощь: рассмотрение советом или ожидание выплаты.',
});

/** Заявление на материальную помощь со стадией и статусом выплаты у кассира. */
export interface MarketplaceAidView {
  hash: string;
  username: string;
  braname: string;
  amount: string;
  /** Стадия заявления: на рассмотрении совета либо одобрено и ждёт выплаты. */
  stage: MarketplaceAidStage;
  /** Null — платёж не найден в реестре, статус выплаты неизвестен. */
  payment_status: PaymentStatus | null;
  /** Маскированная подпись реквизитов («Сбербанк •1234»), null — реквизиты недоступны. */
  payment_destination: string | null;
}

/**
 * requirement b6 «Экономика КУ» (раунд 5 — приоритет общего кошелька):
 * единая ставка членского взноса (стол администратора), веса распределения
 * и ручное распределение из общего кошелька (стол ПВЗ, председатель),
 * оффчейн-реестр плановых расходов с 30-дневным резервом, персональные
 * кошельки доверенных (перевод в «Стол заказов» и материальная помощь).
 *
 * Источник истины конфигурации — on-chain (marketplace::config /
 * branch::weights / branch::weighttotals); балансы — ledger2::userwallets.
 * Плановые расходы — общесистемный реестр расширения `expenses` (решение
 * владельца 2026-06-10: расходы относятся к кооперативу, не к Столу
 * заказов); здесь — только потребление резерва: гард распределения на
 * бэкенде, все пути идут через контроллер.
 */
@Injectable()
export class MarketplaceEconomyService {
  private readonly logger = new Logger(MarketplaceEconomyService.name);

  constructor(
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(EXPENSE_PLANS_SERVICE)
    private readonly expensePlansService: ExpensePlansService,
    @Inject(LEDGER2_HISTORY_PORT)
    private readonly ledger2History: ILedger2HistoryPort,
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly coreGateway: GatewayInteractorPort,
    @Inject(PAYMENT_METHOD_REPOSITORY)
    private readonly paymentMethodRepo: PaymentMethodRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(EXPENSE_CHASSIS_PORT)
    private readonly expenseChassis: IExpenseChassisPort
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
    return this.toHumanPercent(
      config ? config.membership_fee_percent : DEFAULT_MEMBERSHIP_FEE_PERCENT
    );
  }

  /**
   * Сырая контрактная ставка членского взноса (HUNDR_PERCENTS = 100%) —
   * для зеркального расчёта суммы взноса той же целочисленной формулой,
   * что calc_membership_fee в контракте (сумма заявления о конвертации
   * должна побитово совпадать с фактическим списанием).
   */
  async getMembershipFeeContractPercent(coopname: string): Promise<number> {
    const config = await this.chainPort.getEconomyConfig(coopname);
    return config ? Number(config.membership_fee_percent) : DEFAULT_MEMBERSHIP_FEE_PERCENT;
  }

  /** Членский взнос в минимальных единицах валюты — формула контракта. */
  membershipFeeUnits(totalCostUnits: bigint, contractPercent: number): bigint {
    return (totalCostUnits * BigInt(contractPercent)) / BigInt(HUNDR_PERCENTS);
  }

  /**
   * Сумма конвертации строки заказа = стоимость + членский взнос,
   * целочисленно в минимальных единицах валюты той же формулой, что
   * контракт (`calc_membership_fee`): сумма заявления о конвертации
   * должна побитово совпадать с фактическим списанием on-chain.
   */
  convertAmountForLine(pricePerUnit: string, quantity: number, contractPercent: number): string {
    const decimals = this.assetConfig.decimals;
    const totalUnits = this.toUnits(pricePerUnit, decimals) * BigInt(quantity);
    const units = totalUnits + this.membershipFeeUnits(totalUnits, contractPercent);
    const padded = units.toString().padStart(decimals + 1, '0');
    return `${padded.slice(0, padded.length - decimals)}.${padded.slice(-decimals)} ${this.assetConfig.symbol}`;
  }

  /** Десятичная строка → минимальные единицы валюты (без float-погрешности). */
  private toUnits(value: string, decimals: number): bigint {
    const [int, frac = ''] = String(value).trim().split('.');
    const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    return BigInt(int || '0') * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || '0');
  }

  /**
   * Asset-строка («X.XXXX RUB» или «X.XXXX») → минимальные единицы валюты.
   * Символ отбрасывается; целочисленно, без float-погрешности.
   */
  assetToUnits(value: string): bigint {
    const numeric = String(value).trim().split(/\s+/)[0] ?? '0';
    return this.toUnits(numeric, this.assetConfig.decimals);
  }

  /** Минимальные единицы валюты → asset-строка «X.XXXX RUB». */
  unitsToAsset(units: bigint): string {
    const decimals = this.assetConfig.decimals;
    const padded = units.toString().padStart(decimals + 1, '0');
    return `${padded.slice(0, padded.length - decimals)}.${padded.slice(-decimals)} ${this.assetConfig.symbol}`;
  }

  /** Сумма строки заказа (тело + членский взнос) в минимальных единицах валюты. */
  lineUnits(pricePerUnit: string, quantity: number, contractPercent: number): bigint {
    const totalUnits = this.toUnits(pricePerUnit, this.assetConfig.decimals) * BigInt(quantity);
    return totalUnits + this.membershipFeeUnits(totalUnits, contractPercent);
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
    const [weights, totals, balances, reserve] = await Promise.all([
      this.chainPort.getBranchWeights(coopname),
      this.chainPort.getBranchWeightTotals(coopname),
      this.chainPort.listBranchWalletBalances(coopname),
      this.expensePlansService.getReservedAmount(coopname, braname),
    ]);

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

    const available = Math.max(0, this.assetToNumber(commonBalance) - reserve);

    return {
      braname,
      total_weight: totalWeight,
      weights: branchWeights.map((w) => ({
        username: w.username,
        weight: Number(w.weight),
        share_percent: totalWeight > 0 ? (Number(w.weight) * 100) / totalWeight : 0,
        personal_balance: personalBalanceOf(w.username),
      })),
      common_balance: commonBalance,
      reserve_amount: this.formatAsset(reserve),
      available_to_distribute: this.formatAsset(available),
    };
  }

  /**
   * Движения по общему кошельку КУ (`w.brn.common`) — членские взносы с
   * исполненных заказов, изъятия в распределение, оплата плановых расходов.
   * Читается через `LEDGER2_HISTORY_PORT` (ядро ledger2, журнал
   * blockchain_actions) — только apply-записи: они несут operation_code +
   * memo (человекочитаемое назначение, например «по заказу № 123»),
   * walletop/debit/credit того же apply в UI-журнале избыточны.
   *
   * Авторизацию (кто вправе смотреть кошелёк ИМЕННО этого КУ) порт не
   * делает — обязан проверить вызывающий resolver ДО вызова этого метода.
   */
  async getBranchWalletHistory(
    coopname: string,
    braname: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceBranchWalletOperationView>> {
    const result = await this.ledger2History.getHistory({
      coopname,
      walletName: 'w.brn.common',
      username: braname,
      actionNames: ['apply'],
      page: options?.page ?? 1,
      limit: options?.limit ?? 20,
      sortOrder: options?.sortOrder,
    });
    return this.toWalletHistoryResult(coopname, result);
  }

  /**
   * Движения по персональному кошельку членских средств (`w.brn.person`) —
   * только сами «получения»: перевод в Стол заказов (`o.brn.conv`) и
   * завершённая (подтверждённая кассиром) материальная помощь (`o.brn.aid`).
   * Изъятие из общего кошелька в персональный (`o.brn.release`) сюда не
   * входит — это пассивное распределение председателем, не действие самого
   * получателя; смотреть в «Кошельке участка».
   *
   * Вместе с ещё не завершёнными заявками (`listAids`) образует полную
   * историю «Получить» на вкладке «Мои средства» — на фронте объединяются
   * в одну ленту карточек.
   */
  async getPersonalWalletHistory(
    coopname: string,
    username: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceBranchWalletOperationView>> {
    const result = await this.ledger2History.getHistory({
      coopname,
      walletName: 'w.brn.person',
      username,
      actionNames: ['apply'],
      operationCodes: ['o.brn.conv', 'o.brn.aid'],
      page: options?.page ?? 1,
      limit: options?.limit ?? 20,
      sortOrder: options?.sortOrder,
    });
    return this.toWalletHistoryResult(coopname, result);
  }

  /**
   * Движение книги учёта знает заказ-источник только по хэшу процесса
   * поставки, а ссылка «Заказ» ведёт на страницу заказа по его
   * идентификатору — резолвим хэши страницы одним батчем.
   */
  private async toWalletHistoryResult(
    coopname: string,
    result: InnerLedger2HistoryResult
  ): Promise<PaginationResult<MarketplaceBranchWalletOperationView>> {
    const hashes = result.items
      .map((op) => op.processHash)
      .filter((h): h is string => !!h);
    const orders = await this.orderRepo.findByOrderHashes(coopname, hashes);
    const orderIdByHash = new Map(orders.map((o) => [o.order_hash, o.id]));
    return {
      items: result.items.map((op) => ({
        global_sequence: op.globalSequence,
        operation_code: op.operationCode ?? '',
        quantity: op.quantity ?? null,
        memo: op.memo ?? null,
        order_hash: op.processHash ?? null,
        order_id: op.processHash
          ? (orderIdByHash.get(op.processHash.toLowerCase()) ?? null)
          : null,
        created_at: op.createdAt,
      })),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Ручное распределение средств общего кошелька КУ по весам (раунд 5).
   * Гард планового резерва — здесь, на бэкенде: все пути идут через
   * контроллер (прямых пользовательских транзакций нет); он-чейн гард
   * приедет вместе с шасси расходов.
   */
  async distributeBranchFunds(
    coopname: string,
    initiator: string,
    braname: string,
    amount: number
  ): Promise<string> {
    await this.assertIsTrusteeOfBranch(coopname, braname, initiator);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Сумма распределения должна быть больше нуля');
    }

    const economy = await this.getBranchEconomy(coopname, braname);
    if (economy.total_weight <= 0) {
      throw new BadRequestException(
        'Распределение не настроено: задайте веса участников распределения'
      );
    }
    const common = this.assetToNumber(economy.common_balance);
    const reserve = this.assetToNumber(economy.reserve_amount);
    if (common - amount < reserve) {
      throw new BadRequestException(
        `Распределение нарушает плановый резерв расходов на ${EXPENSE_RESERVE_HORIZON_DAYS} дней: ` +
          `в общем кошельке ${economy.common_balance}, резерв ${economy.reserve_amount}, ` +
          `доступно к распределению ${economy.available_to_distribute}`
      );
    }

    const asset = this.formatAsset(amount);
    const round_hash = createHash('sha256')
      .update(`${coopname}:${braname}:distribute:${randomBytes(16).toString('hex')}`)
      .digest('hex');
    try {
      await this.chainPort.distribute({
        coopname,
        braname,
        source_contract: MARKETPLACE_SOURCE_CONTRACT,
        round_hash,
        amount: asset,
        memo: 'Распределение членских взносов кооперативного участка',
      });
    } catch (e) {
      rethrowChainError(e);
    }
    return asset;
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
  ): Promise<InnerGeneratedDocument> {
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
    return this.documentPort.generate({ data: action });
  }

  async createAid(
    coopname: string,
    username: string,
    braname: string,
    amount: number,
    aidHash: string,
    signedStatement: SignedDigitalDocumentInputDTO,
    paymentMethodId: string
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

    // Реквизиты обязаны существовать и принадлежать самому получателю —
    // get скоупится по username, чужой method_id сюда не пролезет.
    let payoutMethod;
    try {
      payoutMethod = await this.paymentMethodRepo.get({ username, method_id: paymentMethodId });
    } catch {
      throw new BadRequestException(
        'Реквизиты не найдены. Добавьте их в разделе «Реквизиты» стола пайщика и выберите снова.'
      );
    }

    // Core-платёж создаётся ДО отправки на цепь и скрыт от кассира
    // (AWAITING_AUTHORIZATION): реквизиты нужно запомнить в момент подачи, а
    // показывать выплату кассиру можно только после решения совета. Перевод в
    // PENDING делает MarketplaceAidCouncilSyncService по callback'у onaidauth.
    // payment_hash обязан совпадать с on-chain outcome_hash — им становится сам
    // aid_hash, по нему же платёж находят слушатели решения совета и кассира.
    try {
      await this.coreGateway.createSystemOutgoingPayment({
        coopname,
        username,
        quantity: amount,
        symbol: this.assetConfig.symbol,
        // Назначение платежа кассир копирует в банк как есть — там нужна только
        // суть выплаты, без служебных идентификаторов участка.
        memo: 'Материальная помощь',
        type: PaymentType.AID,
        status: PaymentStatus.AWAITING_AUTHORIZATION,
        related_extension: 'marketplace',
        related_entity_id: aidHash,
        payment_hash: aidHash,
        payment_method_id: payoutMethod.method_id,
        payment_details: {
          data: payoutMethod.data,
          amount_plus_fee: asset,
          amount_without_fee: asset,
          fee_amount: '0',
          fee_percent: 0,
          fact_fee_percent: 0,
          tolerance_percent: 0,
        },
      });
    } catch (e: any) {
      throw new ConflictException(
        `Не удалось зарегистрировать выплату в реестре платежей: ${e.message}. Заявление не подано, повторите попытку.`
      );
    }

    // Заявление уходит не кассиру, а на повестку совета: выплата денег из
    // кооператива — его компетенция. `meta` дублирует ключевые поля заявления
    // для реестра повесток; сам документ едет в `statement`.
    try {
      await this.chainPort.createAid({
        coopname,
        username,
        braname,
        aid_hash: aidHash,
        amount: asset,
        statement: new SignedDigitalDocumentInputDTO(
          signedStatement
        ).toDocument() as BranchContract.Actions.CreateAid.ICreateaid['statement'],
        meta: JSON.stringify({
          registry_id: Cooperative.Registry.BranchFinancialAidStatement.registry_id,
          aid_hash: aidHash,
          braname,
          amount: asset,
        }),
      });
    } catch (e) {
      // Заявление на повестку не встало — гасим уже созданный платёж, иначе он
      // навсегда останется в AWAITING_AUTHORIZATION без решения совета.
      await this.cancelAidPayment(
        coopname,
        aidHash,
        'Заявление не удалось внести на рассмотрение совета'
      );
      rethrowChainError(e);
    }

    return asset;
  }

  /**
   * Подать расход кооперативного участка на решение совета через шасси
   * расходов (requirement b6, процесс p.brn.spend).
   *
   * Сумма расхода выделяется из общего кошелька участка в пул расходов
   * (контракт делает это в одной транзакции с подачей записки), после чего
   * расходом занимается шасси: совет принимает решение, кассир платит по
   * реквизитам либо выдаёт аванс под отчёт, получатель отчитывается чеками.
   * Неизрасходованный остаток возвращается участку автоматически.
   *
   * Реквизиты получателей в цепь не уходят: до отправки они проверяются, а
   * после успешной подачи фиксируются снимком шасси — последующее изменение
   * реквизитов не меняет то, куда платить по уже поданному расходу.
   */
  async createBranchExpense(
    coopname: string,
    username: string,
    input: CreateBranchExpenseInputDTO
  ): Promise<string> {
    // Отправить расход на решение совета — полномочие председателя участка:
    // с этого момента средства участка выделяются под расход. Планировать
    // расходы может любой оператор участка (см. реестр плановых расходов),
    // но подаёт председатель. Тот же guard стоит в контракте.
    const trustee = await this.kuChairmanService.getTrusteeOfBranch(coopname, input.braname);
    if (trustee !== username) {
      throw new ForbiddenException(
        'Расход на оплату подаёт только председатель этого кооперативного участка'
      );
    }

    this.verifyDocumentSignature(input.statement as unknown as SignedDigitalDocumentInputDTO, username);

    const requisiteItems = input.items.map((item) => ({
      proposalHash: input.expense_hash,
      itemHash: item.item_hash,
      recipient: item.recipient_type === ExpenseRecipientType.ORG ? '' : item.recipient,
      isOrganization: item.recipient_type === ExpenseRecipientType.ORG,
      mechanics: item.mechanics as 'ADVANCE' | 'DIRECT',
      paymentMethodId: item.payment_method_id,
      requisites: item.requisites,
      paymentPurpose: item.payment_purpose,
    }));

    // Реквизиты проверяются ДО цепи: расход без реквизитов кассир не оплатит.
    await this.expenseChassis.validateRequisites(coopname, requisiteItems);

    const items = input.items.map((item) => ({
      item_hash: item.item_hash,
      mechanics: item.mechanics === ExpenseMechanics.DIRECT ? 1 : 0,
      recipient_type:
        item.recipient_type === ExpenseRecipientType.SELF
          ? 0
          : item.recipient_type === ExpenseRecipientType.MEMBER
            ? 1
            : 2,
      recipient: item.recipient_type === ExpenseRecipientType.ORG ? '' : item.recipient,
      description: item.description,
      planned_amount: item.planned_amount,
      actual_amount: this.zeroAsset(),
      status: 0,
    }));

    try {
      await this.chainPort.createBranchExpense({
        coopname,
        braname: input.braname,
        creator: username,
        expense_hash: input.expense_hash,
        items,
        statement: new SignedDigitalDocumentInputDTO(
          input.statement as unknown as SignedDigitalDocumentInputDTO
        ).toDocument() as BranchContract.Actions.CreateExp.ICreateexp['statement'],
      });
    } catch (e) {
      rethrowChainError(e);
    }

    // Снимок реквизитов — только после успешной подачи (канон шасси).
    await this.expenseChassis.snapshotRequisites(coopname, requisiteItems);

    if (input.plan_id) {
      await this.expensePlansService.attachProposal(coopname, input.plan_id, input.expense_hash);
    }

    return input.expense_hash;
  }

  /** Отменить core-платёж заявки по её hash. Молчит, если платежа нет. */
  private async cancelAidPayment(coopname: string, aidHash: string, reason: string): Promise<void> {
    try {
      const found = await this.coreGateway.getPayments(
        { coopname, hash: aidHash.toLowerCase() },
        { page: 1, limit: 1, sortOrder: 'DESC' }
      );
      const payment = found.items[0];
      if (payment?.id) {
        await this.coreGateway.setPaymentStatus({
          id: payment.id,
          status: PaymentStatus.CANCELLED,
          message: reason,
        });
      }
    } catch (e: any) {
      this.logger.warn(`Не удалось отменить платёж заявки ${aidHash}: ${e.message}`);
    }
  }

  async listAids(coopname: string, username?: string): Promise<MarketplaceAidView[]> {
    const aids = await this.chainPort.listAids(coopname);
    const scoped = username ? aids.filter((a) => a.username === username) : aids;
    return Promise.all(scoped.map((aid) => this.toAidView(coopname, aid)));
  }

  /**
   * Статус и реквизиты core-платежа заявки, по её hash. `null`/`null` —
   * платёж не создался (см. предупреждение в createAid) либо реквизиты с тех
   * пор удалены получателем — не блокирует отображение самой заявки.
   */
  private async toAidView(
    coopname: string,
    aid: BranchContract.Tables.Aids.IBranchAid
  ): Promise<MarketplaceAidView> {
    const hash = String(aid.hash);
    let payment_status: PaymentStatus | null = null;
    let payment_destination: string | null = null;
    try {
      const found = await this.coreGateway.getPayments(
        { coopname, hash: hash.toLowerCase() },
        { page: 1, limit: 1, sortOrder: 'DESC' }
      );
      const payment = found.items[0];
      if (payment) {
        payment_status = payment.status;
        if (payment.payment_method_id) {
          try {
            const method = await this.paymentMethodRepo.get({
              username: aid.username,
              method_id: payment.payment_method_id,
            });
            payment_destination = formatPayoutDestination(method);
          } catch {
            // Реквизиты удалены получателем после подачи заявки — не блокирует.
          }
        }
      }
    } catch {
      // Платёж не найден в реестре — статус выплаты неизвестен.
    }
    return {
      hash,
      username: aid.username,
      braname: String(aid.braname),
      amount: aid.amount,
      stage:
        String(aid.status) === BRANCH_AID_STATUS_AUTHORIZED
          ? MarketplaceAidStage.AWAITING_PAYOUT
          : MarketplaceAidStage.ON_COUNCIL,
      payment_status,
      payment_destination,
    };
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
