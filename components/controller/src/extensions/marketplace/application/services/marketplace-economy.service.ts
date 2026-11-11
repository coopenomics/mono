import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { registerEnumType } from '@nestjs/graphql';
import { createHash, randomBytes } from 'crypto';
import { type BranchContract } from 'cooptypes';
import { Registry } from '@coopenomics/docs-templates';
import { PublicKey, Signature } from '@wharfkit/antelope';
import http from 'http-status';
import { LEDGER2_HISTORY_PORT, type ILedger2HistoryPort, type InnerLedger2HistoryResult, EXPENSE_CHASSIS_PORT, type IExpenseChassisPort, DOCUMENT_PORT, type IDocumentPort, type InnerGeneratedDocument, type InnerExpensePlan } from '@coopenomics/innercoop';
import { PaymentStatus, PaymentType } from '@coopenomics/innercoop';
import { SignedDigitalDocumentInputDTO, PaginationInputDTO, type PaginationResult, rethrowChainError, DomainError, standPeriodKey } from '@coopenomics/extension-kit';
import type { MarketplaceUnitOfMeasure } from '../../domain/entities/marketplace-offer.types';
import { calcCostMinor } from '../shared/cost.util';
import type { ResolvedSaleUnit } from '../shared/packaging.util';
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

import { formatPayoutDestination } from '../shared/payout-destination.util';
import { ndflBreakdown } from '../shared/ndfl.util';
import { PERIOD_TIME_ZONE, periodBounds } from '../shared/period-bounds';
import { plannedTargetUnits } from '../shared/planned-target.util';
import { type CreateBranchExpenseInputDTO } from '../dto/branch-expense.dto';
// Способ оплаты и тип получателя — словарь шасси расходов из межрасширенческого
// контракта. Регистрацию перечня в схеме держит само шасси, потребителю нужны
// значения.
import {
  InnerExpenseMechanics as ExpenseMechanics,
  InnerExpenseRecipientType as ExpenseRecipientType,
} from '@coopenomics/innercoop';
import { PAYMENT_METHOD_PORT, type IPaymentMethodPort } from '@coopenomics/innercoop';
import { PAYMENT_DESK_PORT, type IPaymentDeskPort, type InnerPayment, VAT_EXEMPT_NOTE } from '@coopenomics/innercoop';
import { t as i18nT } from '../../i18n';
import { TableStore } from '@coopenomics/extension-kit';
import { MARKETPLACE_BRANCH_AID_STORE } from '../../infrastructure/database/marketplace-stores';
import { MarketplaceBranchAidStatus, type MarketplaceBranchAidEntity } from '../../infrastructure/entities/marketplace-branch-aid.entity';

/** Значение `aids.status` на цепи, означающее «совет одобрил, ждёт выплаты». */
const BRANCH_AID_STATUS_AUTHORIZED = 'authorized';
/** Сколько выплаченных заявлений показывать в списке — последние по дате выплаты. */
const PAID_AIDS_LIMIT = 50;

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
const DEFAULT_MEMBERSHIP_FEE_PERCENT = 380_000;

/** Контракт-источник распределения в реестре весов branch::weights. */
const MARKETPLACE_SOURCE_CONTRACT = 'marketplace';

/** Общий кошелёк участка: владелец строки — имя участка. */
const BRANCH_COMMON_WALLET = 'w.brn.common';
/** Персональный кошелёк членских средств доверенного лица участка. */
const BRANCH_PERSONAL_WALLET = 'w.brn.person';

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
  /** Резерв плановых расходов: неоплаченные записи со сроком до конца текущего месяца (задача 99D-34), asset-строка. */
  reserve_amount: string;
  /** Доступно к распределению: общий кошелёк минус резерв, asset-строка. */
  available_to_distribute: string;
  /** Свободные средства инициаторов участка (`MarketInvest::free_of`), asset-строка. */
  initiators_free: string;
  /**
   * Доступно для расходов (99D-35): общий кошелёк и свободные средства
   * инициаторов, asset-строка. Платёж контракт оплачивает целиком из одного
   * источника — хватает ли на запись, стол сверяет по каждому источнику.
   */
  available_for_expenses: string;
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
  /** Чьё это движение: участок для общего кошелька, пайщик для персонального. */
  username?: string | null;
  created_at: Date;
}

/**
 * Операции участка, которые показываются в составе одного процесса на панели
 * движения по общему кошельку: поступление и возврат членского взноса,
 * распределение (изъятие и зачисление доверенным), выделение под расход и
 * возврат неизрасходованного, излишек возмещения инициаторам.
 */
const BRANCH_MOVEMENT_OPERATIONS = [
  'o.brn.common',
  'o.brn.retfee',
  'o.brn.release',
  'o.brn.person',
  'o.brn.expfnd',
  'o.brn.expunf',
  'o.mkt.rpsurp',
];

/** Сколько движений процесса показывает панель: распределение — пара на доверенного. */
const BRANCH_MOVEMENT_PARTS_LIMIT = 100;

/** Стадия заявления на материальную помощь. */
export enum MarketplaceAidStage {
  /** Заявление подписано и внесено на рассмотрение совета. */
  ON_COUNCIL = 'ON_COUNCIL',
  /** Совет одобрил выплату — заявка передана кассиру. */
  AWAITING_PAYOUT = 'AWAITING_PAYOUT',
  /** Кассир подтвердил перевод — помощь выплачена, строка цепи стёрта. */
  PAID = 'PAID',
}

registerEnumType(MarketplaceAidStage, {
  name: 'MarketplaceAidStage',
  description: 'Стадия заявления на материальную помощь: рассмотрение советом, ожидание выплаты или выплачено.',
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
  /** Налог, который кооператив удерживает с суммы заявления, — показ, деление как в контракте. */
  ndfl_tax: string;
  /** Сумма на счёт получателя: сумма заявления за вычетом налога. */
  net_amount: string;
  /**
   * Вехи процесса: подача, решение совета, исполнение или отказ платежа.
   * Платёж заводится при подаче скрытым от кассира и поступает ему решением
   * совета, поэтому отдельной вехи «передан кассиру» нет. Null — вехи ещё нет.
   */
  submitted_at: Date | null;
  decided_at: Date | null;
  payment_completed_at: Date | null;
  payment_failed_at: Date | null;
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
    @Inject(LEDGER2_HISTORY_PORT)
    private readonly ledger2History: ILedger2HistoryPort,
    @Inject(PAYMENT_DESK_PORT)
    private readonly coreGateway: IPaymentDeskPort,
    @Inject(PAYMENT_METHOD_PORT)
    private readonly paymentMethodRepo: IPaymentMethodPort,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(EXPENSE_CHASSIS_PORT)
    private readonly expenseChassis: IExpenseChassisPort,
    @Inject(MARKETPLACE_BRANCH_AID_STORE)
    private readonly aidStore: TableStore<MarketplaceBranchAidEntity>
  ) {}

  /**
   * Свободные средства инициаторов участка, число в валюте: неиспользованные
   * деньги минус выделенные под расходы и помощь (`MarketInvest::free_of`).
   */
  private async initiatorFreeFunds(coopname: string, braname: string): Promise<number> {
    const branch = await this.chainPort.getInvestBranch(coopname, braname);
    if (!branch) return 0;
    const free = this.assetToNumber(String(branch.unused_total)) - this.assetToNumber(String(branch.reserved));
    return free > 0 ? free : 0;
  }

  // ── Проценты: human (1.5 = 1.5%) ↔ контрактная шкала HUNDR_PERCENTS ──

  private toContractPercent(human: number, label: string): number {
    if (!Number.isFinite(human) || human < 0 || human > 100) {
      throw DomainError.badRequest('MARKETPLACE_ECONOMY_PERCENT_OUT_OF_RANGE', { label });
    }
    return Math.round((human * HUNDR_PERCENTS) / 100);
  }

  private toHumanPercent(contractValue: number | string): number {
    return (Number(contractValue) * 100) / HUNDR_PERCENTS;
  }

  /** Контрактная ставка (HUNDR_PERCENTS = 100%) → проценты для человека (30 = 30%). */
  toHumanFeePercent(contractValue: number | string): number {
    return this.toHumanPercent(contractValue);
  }

  /**
   * Тело строки заказа в минимальных единицах валюты — каноническим расчётом
   * стоимости (`calcCostMinor`, зеркало `Marketplace::calc_cost`): по мере —
   * базовое количество × цена с округлением половины вверх, упаковкой — число
   * упаковок × цена упаковки. До 25.09.2026 здесь было `BigInt(количество)`,
   * и дробная мера (1,5 кг) роняла превью и оформление корзины ошибкой 500.
   */
  lineBodyUnits(sale: Pick<ResolvedSaleUnit, 'baseQuantity' | 'unitPrice' | 'packageSize'>, unit: MarketplaceUnitOfMeasure): bigint {
    return calcCostMinor({
      quantity: sale.baseQuantity,
      unit,
      unitPrice: sale.unitPrice,
      packageSize: sale.packageSize,
      decimals: this.assetConfig.decimals,
    });
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

  async setMembershipFee(coopname: string, feePercentHuman: number): Promise<number> {
    // Человеку это поле известно как «целевой членский взнос» (стол администратора) —
    // сообщение об ошибке должно говорить его словами.
    const membership_fee_percent = this.toContractPercent(
      feePercentHuman,
      i18nT('marketplace.economy.targetMembershipFeeLabel')
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
    const [weights, totals, common, plans, initiatorsFree] = await Promise.all([
      this.chainPort.getBranchWeights(coopname, braname),
      this.chainPort.getBranchWeightTotals(coopname, braname),
      this.chainPort.getUserWallet(coopname, BRANCH_COMMON_WALLET, braname),
      this.expenseChassis.listPlans(coopname, braname),
      this.initiatorFreeFunds(coopname, braname),
    ]);
    // Резерв общего кошелька, который нельзя распределить (задача 99D-34), —
    // цель плановых расходов на сегодня: неоплаченные записи со сроком до
    // конца текущего месяца, их собрал прошлый итог месяца. Та же функция
    // считает факт цели для итога месяца.
    const timeZone = PERIOD_TIME_ZONE;
    const monthEnd = periodBounds(standPeriodKey(new Date(), timeZone), timeZone).end;
    const reserveUnits = plannedTargetUnits(plans, braname, monthEnd, (a) => this.assetToUnits(a), (d) => standPeriodKey(d, timeZone));
    const reserve = { amount: Number(reserveUnits) / 10 ** this.assetConfig.decimals };

    const branchWeights = weights.filter((w) => w.contract === MARKETPLACE_SOURCE_CONTRACT);
    const total = totals.find((t) => t.contract === MARKETPLACE_SOURCE_CONTRACT);
    const totalWeight = total ? Number(total.total_weight) : 0;

    // Персональные кошельки доверенных участка — по одному чтению на получателя веса.
    const personal = new Map<string, string>();
    await Promise.all(
      branchWeights.map(async (w) => {
        personal.set(String(w.username), await this.getPersonalBalance(coopname, String(w.username)));
      })
    );
    const personalBalanceOf = (username: string): string => personal.get(username) ?? this.zeroAsset();

    const commonBalance = common?.available ?? this.zeroAsset();

    const available = Math.max(0, this.assetToNumber(commonBalance) - reserve.amount);

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
      reserve_amount: this.formatAsset(reserve.amount),
      available_to_distribute: this.formatAsset(available),
      initiators_free: this.formatAsset(initiatorsFree),
      available_for_expenses: this.formatAsset(this.assetToNumber(commonBalance) + initiatorsFree),
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
      walletName: BRANCH_COMMON_WALLET,
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
      walletName: BRANCH_PERSONAL_WALLET,
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
  /**
   * Движения участка в одном процессе — для панели строки «Движения по
   * кошельку»: у распределения это изъятие из общего кошелька и зачисление
   * каждому доверенному (кто сколько получил), у заказа — взнос участку.
   * Отдаются только операции участка из `BRANCH_MOVEMENT_OPERATIONS`: прочие
   * движения процесса (кошельки пайщика по заказу) панели участка не нужны.
   * Процесс чужого участка не раскрывается — в нём нет движения этого участка.
   */
  async getBranchMovementParts(
    coopname: string,
    braname: string,
    processHash: string
  ): Promise<MarketplaceBranchWalletOperationView[]> {
    const result = await this.ledger2History.getHistory({
      coopname,
      processHash,
      actionNames: ['apply'],
      operationCodes: BRANCH_MOVEMENT_OPERATIONS,
      page: 1,
      limit: BRANCH_MOVEMENT_PARTS_LIMIT,
      sortOrder: 'ASC',
    });
    if (!result.items.some((op) => op.username === braname)) return [];
    const view = await this.toWalletHistoryResult(coopname, result);
    return view.items;
  }

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
        username: op.username ?? null,
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
    // Распределения одного участка идут по очереди: резерв плановых расходов
    // проверяет узел, контракт о нём не знает. Два одновременных распределения
    // оба прошли бы проверку по одному остатку и вместе съели бы резерв.
    const key = `${coopname}:${braname}`;
    const previous = this.distributing.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => this.distributeOnce(coopname, initiator, braname, amount));
    this.distributing.set(key, run);
    try {
      return await run;
    } finally {
      if (this.distributing.get(key) === run) this.distributing.delete(key);
    }
  }

  /** Очередь распределений по участкам: следующее читает остаток после завершения предыдущего. */
  private readonly distributing = new Map<string, Promise<unknown>>();

  private async distributeOnce(coopname: string, initiator: string, braname: string, amount: number): Promise<string> {
    await this.assertIsTrusteeOfBranch(coopname, braname, initiator);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw DomainError.badRequest('MARKETPLACE_DISTRIBUTION_AMOUNT_MUST_BE_POSITIVE');
    }

    const economy = await this.getBranchEconomy(coopname, braname);
    if (economy.total_weight <= 0) {
      throw DomainError.badRequest('MARKETPLACE_DISTRIBUTION_NOT_CONFIGURED');
    }
    const common = this.assetToNumber(economy.common_balance);
    const reserve = this.assetToNumber(economy.reserve_amount);
    if (common - amount < reserve) {
      throw new BadRequestException(
        i18nT('marketplace.economy.distributionReserveViolationIntro') +
          i18nT('marketplace.economy.distributionReserveDetail', { commonBalance: economy.common_balance, reserveAmount: economy.reserve_amount }) +
          i18nT('marketplace.economy.distributionAvailable', { availableToDistribute: economy.available_to_distribute })
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
        memo: i18nT('marketplace.economy.distributionTitle'),
      });
    } catch (e) {
      rethrowChainError(e);
    }
    return asset;
  }

  /** Баланс персонального кошелька (w.brn.person) одного доверенного. */
  async getPersonalBalance(coopname: string, username: string): Promise<string> {
    const wallet = await this.chainPort.getUserWallet(coopname, BRANCH_PERSONAL_WALLET, username);
    return wallet?.available ?? this.zeroAsset();
  }

  private async assertIsTrusteeOfBranch(
    coopname: string,
    braname: string,
    username: string
  ): Promise<void> {
    const trustee = await this.kuChairmanService.getTrusteeOfBranch(coopname, braname);
    if (trustee !== username) {
      throw DomainError.forbidden('MARKETPLACE_DISTRIBUTION_SETTINGS_FORBIDDEN');
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
      throw DomainError.badRequest('MARKETPLACE_DISTRIBUTION_WEIGHT_INVALID');
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

  // ── Свободный паевой Стола заказов ───────────────────────────────────


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
      throw DomainError.badRequest('MARKETPLACE_AID_AMOUNT_MUST_BE_POSITIVE');
    }
    const isMember = await this.kuChairmanService.isMemberOfBranch(coopname, braname, username);
    if (!isMember) {
      throw DomainError.forbidden('MARKETPLACE_AID_FORBIDDEN');
    }
    const aid_hash = createHash('sha256')
      .update(`${coopname}:${username}:aid:${randomBytes(16).toString('hex')}`)
      .digest('hex');
    const action: Registry.BranchFinancialAidStatement.Action = {
      registry_id: Registry.BranchFinancialAidStatement.registry_id,
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
      throw DomainError.badRequest('MARKETPLACE_AID_AMOUNT_MUST_BE_POSITIVE');
    }
    const isMember = await this.kuChairmanService.isMemberOfBranch(coopname, braname, username);
    if (!isMember) {
      throw DomainError.forbidden('MARKETPLACE_AID_FORBIDDEN');
    }

    this.verifyDocumentSignature(signedStatement, username);
    const meta = signedStatement.meta as
      | { registry_id?: number; aid_hash?: string; amount?: string }
      | undefined;
    if (
      !meta ||
      meta.registry_id !== Registry.BranchFinancialAidStatement.registry_id
    ) {
      throw DomainError.badRequest('MARKETPLACE_AID_STATEMENT_WRONG_REGISTRY', { registryId: Registry.BranchFinancialAidStatement.registry_id });
    }
    if (meta.aid_hash && meta.aid_hash !== aidHash) {
      throw DomainError.conflict('MARKETPLACE_AID_STATEMENT_WRONG_REQUEST');
    }

    // Источник помощи — как в контракте (createaid, задача 99D-28): персональный
    // кошелёк получателя, а при нехватке — свободные средства инициаторов
    // участка. Отказ — до цепи, когда не хватает ни того, ни другого.
    const asset = this.formatAsset(amount);
    const balance = await this.getPersonalBalance(coopname, username);
    if (this.assetToNumber(balance) < amount) {
      const free = await this.initiatorFreeFunds(coopname, braname);
      if (free < amount) {
        throw DomainError.badRequest('MARKETPLACE_PERSONAL_WALLET_INSUFFICIENT_FUNDS', { balance, free: this.formatAsset(free), requested: asset });
      }
    }

    // Реквизиты обязаны существовать и принадлежать самому получателю —
    // get скоупится по username, чужой method_id сюда не пролезет.
    let payoutMethod;
    try {
      payoutMethod = await this.paymentMethodRepo.get({ username, method_id: paymentMethodId });
    } catch {
      throw DomainError.badRequest('MARKETPLACE_PAYMENT_DETAILS_NOT_FOUND');
    }

    // До отправки в цепь сохраняется заявка на выплату с реквизитами,
    // выбранными при подаче: платежа кассиру до решения совета нет. Платёж из
    // заявки создаёт MarketplaceAidCouncilSyncService по callback'у onaidauth.
    // Реквизиты живут в базе узла и в цепь не попадают. payment_hash обязан
    // совпадать с on-chain outcome_hash — им становится сам aid_hash, по нему
    // же платёж находят слушатели решения совета и кассира.
    // Кооператив — налоговый агент: кассиру уходит сумма за вычетом НДФЛ,
    // а с персонального кошелька спишется всё заявление. Расчёт зеркалит
    // `BranchNdfl` контракта, иначе платёж и проводка разойдутся.
    const { tax: taxAmount, net: netAmount } = ndflBreakdown(amount, this.assetConfig.decimals);
    const netAsset = this.formatAsset(netAmount);

    try {
      await this.coreGateway.registerPayoutRequest({
        coopname,
        username,
        quantity: netAmount,
        symbol: this.assetConfig.symbol,
        // Назначение платежа кассир копирует в банк как есть: суть выплаты,
        // её номер и налоговая оговорка. Номер — начало хэша заявки, как и
        // везде в реестрах: по нему выписка сходится с заявлением, если выплат
        // в день несколько.
        memo: i18nT('marketplace.economy.aidPaymentTitle', { aidHashShort: aidHash.slice(0, 8), vatExemptNote: VAT_EXEMPT_NOTE }),
        type: PaymentType.AID,
        related_extension: 'marketplace',
        related_entity_id: aidHash,
        payment_hash: aidHash,
        payment_method_id: payoutMethod.method_id,
        payment_details: {
          data: payoutMethod.data,
          amount_plus_fee: netAsset,
          amount_without_fee: netAsset,
          fee_amount: '0',
          fee_percent: 0,
          fact_fee_percent: 0,
          tolerance_percent: 0,
        },
      });
    } catch (e: any) {
      throw DomainError.conflict('MARKETPLACE_AID_PAYMENT_REGISTRATION_FAILED', { errorMessage: e.message });
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
          registry_id: Registry.BranchFinancialAidStatement.registry_id,
          aid_hash: aidHash,
          braname,
          amount: asset,
        }),
      });
    } catch (e) {
      // Заявление на повестку не встало — снимаем заявку на выплату: решения
      // совета по ней не будет.
      await this.dropAidPayoutRequest(aidHash);
      rethrowChainError(e);
    }

    // Разбивка нужна в логе: кассир видит одну сумму, кошелёк уменьшится на
    // другую, и без этой строки расхождение выглядит как ошибка расчёта.
    this.logger.log(
      `Матпомощь ${aidHash.slice(0, 8)}: начислено ${asset}, ` +
        `удержан налог ${this.formatAsset(taxAmount)}, к перечислению ${netAsset}`
    );

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
      throw DomainError.forbidden('MARKETPLACE_EXPENSE_SUBMIT_FORBIDDEN');
    }

    this.verifyDocumentSignature(input.statement as unknown as SignedDigitalDocumentInputDTO, username);

    // Запись плана проверяется ДО цепи: контракт о реестре планов не знает и
    // примет вторую записку по той же записи — участок выделил бы деньги
    // дважды, а совет получил бы два вопроса об одном расходе. Привязка после
    // цепи эту подачу уже не остановит.
    const planId = input.plan_id ?? null;
    if (planId !== null) {
      const plan = await this.assertPlanPayable(coopname, input.braname, planId);
      this.assertProposalMatchesPlan(plan, input);
      this.launchingPlans.add(planId);
    }
    try {
      return await this.submitBranchExpense(coopname, username, input);
    } finally {
      if (planId !== null) this.launchingPlans.delete(planId);
    }
  }

  /** Записи плана, по которым записка прямо сейчас подаётся в цепь: вторая подача той же записи ждать не будет. */
  private readonly launchingPlans = new Set<number>();

  /**
   * Запись плана можно оплатить: она принадлежит участку, оплата по ней не
   * запущена и не завершена, и другая подача по ней сейчас не идёт.
   */
  private async assertPlanPayable(coopname: string, braname: string, planId: number): Promise<InnerExpensePlan> {
    if (this.launchingPlans.has(planId)) throw DomainError.badRequest('EXPENSES_PLAN_PAYMENT_ALREADY_STARTED');
    const plan = (await this.expenseChassis.listPlans(coopname, braname)).find((p) => Number(p.id) === Number(planId));
    if (!plan || plan.branchName !== braname) throw DomainError.notFound('EXPENSES_PLAN_NOT_FOUND');
    if (plan.proposalHash || plan.paidAt) throw DomainError.badRequest('EXPENSES_PLAN_PAYMENT_ALREADY_STARTED');
    return plan;
  }

  /**
   * Записка по записи плана со способом оплаты (задача 99D-35) — ровно один
   * платёж этой записи: та же сумма, тот же получатель, тот же контрагент и
   * назначение платежа либо тот же пайщик и способ получения средств.
   * Записку собирает стол из записи, но сервер не верит столу на слово:
   * иначе по записи «электроэнергия» можно было бы заплатить другому. Запись
   * без способа оплаты (до 99D-35) сверяется только по суммам цепи, как прежде.
   */
  private assertProposalMatchesPlan(plan: InnerExpensePlan, input: CreateBranchExpenseInputDTO): void {
    if (!plan.recipientType) return;
    if (input.items.length !== 1) throw planMismatch('items');
    const [item] = input.items;
    if (this.assetToUnits(item.planned_amount) !== this.assetToUnits(plan.amount)) throw planMismatch('planned_amount');
    if (item.recipient_type !== plan.recipientType) throw planMismatch('recipient_type');
    const field = plan.recipientType === ExpenseRecipientType.ORG ? orgItemMismatch(plan, item) : advanceItemMismatch(plan, item);
    if (field) throw planMismatch(field);
  }


  /** Подача записки на расход участка: реквизиты, цепь, снимок реквизитов и привязка записи плана. */
  private async submitBranchExpense(coopname: string, username: string, input: CreateBranchExpenseInputDTO): Promise<string> {
    const requisiteItems = input.items.map((item) => ({
      proposalHash: input.expense_hash,
      itemHash: item.item_hash,
      recipient: item.recipient_type === ExpenseRecipientType.ORG ? '' : item.recipient,
      isOrganization: item.recipient_type === ExpenseRecipientType.ORG,
      mechanics: item.mechanics as 'ADVANCE' | 'DIRECT',
      paymentMethodId: item.payment_method_id,
      requisites: item.requisites,
      paymentPurpose: item.payment_purpose,
      recipientName: item.recipient_name,
      counterpartyId: item.counterparty_id,
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
      await this.expenseChassis.attachPlanToProposal(coopname, input.plan_id, input.expense_hash);
    }

    return input.expense_hash;
  }

  /** Снять заявку на выплату, не дошедшую до совета. Молчит, если заявки нет. */
  private async dropAidPayoutRequest(aidHash: string): Promise<void> {
    try {
      await this.coreGateway.dropPayoutRequest(aidHash.toLowerCase());
    } catch (e: any) {
      this.logger.warn(`Не удалось снять заявку на выплату ${aidHash}: ${e.message}`);
    }
  }

  /**
   * Заявления в работе — из цепи, выплаченные — из зеркала узла: после
   * выплаты контракт стирает строку, а пайщик должен видеть, что ему
   * выплачено (владелец 08.11.2026). Выплаченные — последние по дате выплаты.
   */
  async listAids(coopname: string, username?: string): Promise<MarketplaceAidView[]> {
    const [aids, paid] = await Promise.all([
      this.chainPort.listAids(coopname, username),
      this.aidStore
        .find(
          { coopname, status: MarketplaceBranchAidStatus.PAID, ...(username ? { username } : {}) },
          { order: { paid_at: 'DESC' }, limit: PAID_AIDS_LIMIT }
        )
        .catch(() => [] as MarketplaceBranchAidEntity[]),
    ]);
    const active = await Promise.all(aids.map((aid) => this.toAidView(coopname, aid)));
    const activeHashes = new Set(active.map((a) => a.hash.toLowerCase()));
    const done = await Promise.all(
      paid.filter((row) => !activeHashes.has(row.aid_hash)).map((row) => this.toPaidAidView(coopname, row))
    );
    return [...active, ...done];
  }

  /** Выплаченное заявление из зеркала: сумма, налог, реквизиты и даты платежа. */
  private async toPaidAidView(coopname: string, row: MarketplaceBranchAidEntity): Promise<MarketplaceAidView> {
    const payment = await this.aidPayment(coopname, row.aid_hash);
    let payment_destination: string | null = null;
    if (payment?.payment_method_id) {
      try {
        const method = await this.paymentMethodRepo.get({ username: row.username, method_id: payment.payment_method_id });
        payment_destination = formatPayoutDestination(method);
      } catch {
        // Реквизиты удалены получателем — строка всё равно показывается.
      }
    }
    const symbol = this.assetConfig.symbol;
    const amount = Number(row.amount);
    const ndfl = ndflBreakdown(amount, this.assetConfig.decimals);
    return {
      hash: row.aid_hash,
      username: row.username,
      braname: row.braname,
      amount: `${amount.toFixed(this.assetConfig.decimals)} ${symbol}`,
      stage: MarketplaceAidStage.PAID,
      payment_status: payment?.status ?? null,
      payment_destination,
      ndfl_tax: `${ndfl.tax.toFixed(this.assetConfig.decimals)} ${symbol}`,
      net_amount: `${ndfl.net.toFixed(this.assetConfig.decimals)} ${symbol}`,
      submitted_at: row.created_at ? new Date(row.created_at) : null,
      decided_at: null,
      payment_completed_at: payment?.completed_at ?? (row.paid_at ? new Date(row.paid_at) : null),
      payment_failed_at: payment?.failed_at ?? null,
    };
  }

  /**
   * Заявление для строки и панели стола: стадия, реквизиты и статус платежа,
   * налог и сумма на счёт, вехи процесса (подача, решение совета, платёж).
   * Платёж не найден или реквизиты удалены — заявление всё равно показывается.
   * Дата подачи — из зеркала заявлений узла, решение — по подписи протокола.
   */
  private async toAidView(
    coopname: string,
    aid: BranchContract.Tables.Aids.IBranchAid
  ): Promise<MarketplaceAidView> {
    const hash = String(aid.hash);
    const payment = await this.aidPayment(coopname, hash);
    // До решения совета платежа нет — реквизиты берутся из заявки на выплату.
    const methodId = payment?.payment_method_id ?? (await this.aidPayoutMethodId(hash));
    let payment_destination: string | null = null;
    if (methodId) {
      try {
        const method = await this.paymentMethodRepo.get({ username: aid.username, method_id: methodId });
        payment_destination = formatPayoutDestination(method);
      } catch {
        // Реквизиты удалены получателем после подачи заявки — не блокирует.
      }
    }
    const mirror = await this.aidStore.findOne({ aid_hash: hash.toLowerCase() }).catch(() => null);
    const ndfl = ndflBreakdown(this.assetToNumber(aid.amount), this.assetConfig.decimals);
    const symbol = aid.amount.split(' ')[1] ?? this.assetConfig.symbol;
    return {
      hash,
      username: aid.username,
      braname: String(aid.braname),
      amount: aid.amount,
      stage:
        String(aid.status) === BRANCH_AID_STATUS_AUTHORIZED
          ? MarketplaceAidStage.AWAITING_PAYOUT
          : MarketplaceAidStage.ON_COUNCIL,
      payment_status: payment?.status ?? null,
      payment_destination,
      ndfl_tax: `${ndfl.tax.toFixed(this.assetConfig.decimals)} ${symbol}`,
      net_amount: `${ndfl.net.toFixed(this.assetConfig.decimals)} ${symbol}`,
      submitted_at: mirror?.created_at ? new Date(mirror.created_at) : null,
      decided_at: this.protocolSignedAt(aid),
      payment_completed_at: payment?.completed_at ?? null,
      payment_failed_at: payment?.failed_at ?? null,
    };
  }

  /**
   * Платёж ядра по хэшу заявки; не найден — null, статус выплаты неизвестен.
   * У одной заявки бывает несколько строк платежа: отмена кассиром оставляет
   * отменённую строку, а выплата в шлюзе цепи остаётся в ожидании (контракт
   * отказ от выплаты не принимает). Показываем действующую строку, а
   * отменённую — только если других нет.
   */
  private async aidPayment(coopname: string, hash: string): Promise<InnerPayment | null> {
    try {
      const found = await this.coreGateway.getPayments(
        { coopname, hash: hash.toLowerCase() },
        { page: 1, limit: 5, sortOrder: 'DESC' }
      );
      return found.items.find((p) => p.status !== PaymentStatus.CANCELLED) ?? found.items[0] ?? null;
    } catch {
      return null;
    }
  }

  /** Реквизиты заявки на выплату, пока платежа нет; заявки нет — null. */
  private async aidPayoutMethodId(hash: string): Promise<string | null> {
    try {
      return (await this.coreGateway.getPayoutRequest(hash.toLowerCase()))?.payment_method_id ?? null;
    } catch {
      return null;
    }
  }

  /** Время подписи протокола совета — момент решения; протокола ещё нет — null. */
  private protocolSignedAt(aid: BranchContract.Tables.Aids.IBranchAid): Date | null {
    const signedAt = aid.protocol?.signatures?.[0]?.signed_at;
    if (!signedAt || /^0+$/.test(String(aid.protocol?.hash ?? '0'))) return null;
    const date = new Date(`${String(signedAt).replace(/Z?$/, 'Z')}`);
    return Number.isNaN(date.getTime()) ? null : date;
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
    if (!sig) throw DomainError.badRequest('MARKETPLACE_AID_STATEMENT_NOT_SIGNED');
    if (sig.signer !== expectedSigner) {
      throw DomainError.badRequest('MARKETPLACE_AID_STATEMENT_WRONG_SIGNER');
    }
    const publicKey = PublicKey.from(sig.public_key);
    const signature = Signature.from(sig.signature);
    const verified = signature.verifyDigest(sig.signed_hash, publicKey);
    if (!verified) {
      throw DomainError.badRequest('MARKETPLACE_AID_STATEMENT_SIGNATURE_INVALID');
    }
  }
}

type BranchExpenseItem = CreateBranchExpenseInputDTO['items'][number];

function planMismatch(field: string): Error {
  return DomainError.badRequest('EXPENSES_PLAN_PROPOSAL_MISMATCH', { field });
}

/** Поле, в котором пункт записки расходится с записью-оплатой организации; пусто — совпадает. */
function orgItemMismatch(plan: InnerExpensePlan, item: BranchExpenseItem): string | null {
  if (Number(item.counterparty_id) !== Number(plan.counterpartyId)) return 'counterparty_id';
  if ((item.payment_purpose ?? '').trim() !== (plan.paymentPurpose ?? '').trim()) return 'payment_purpose';
  return null;
}

/** Поле, в котором пункт записки расходится с записью-авансом пайщику; пусто — совпадает. */
function advanceItemMismatch(plan: InnerExpensePlan, item: BranchExpenseItem): string | null {
  if (item.recipient !== plan.recipient) return 'recipient';
  if ((item.payment_method_id ?? '') !== (plan.paymentMethodId ?? '')) return 'payment_method_id';
  return null;
}
