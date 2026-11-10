import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DomainError, platformSettings, rethrowChainError, standMonthSeconds } from '@coopenomics/extension-kit';
import { MarketContract, type BranchContract } from 'cooptypes';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';
import { MarketplaceKuChairmanService } from './marketplace-ku-chairman.service';
import { MarketplaceBranchAidMirrorService } from './marketplace-branch-aid-mirror.service';
import { t as i18nT } from '../../i18n';

/** Контрактная шкала процентов: HUNDR_PERCENTS (1 000 000) = 100 %. */
const HUNDR_PERCENTS = 1_000_000;
/** Доля инициатора по умолчанию — зеркало DEFAULT_INITIATOR_SHARE_PERCENT контракта marketplace. */
const DEFAULT_INITIATOR_SHARE_PERCENT = 618_000;

/** Строка резерва получателя с остатком на текущий месяц. */
export interface MarketplaceBranchReserveView {
  username: string;
  /** Резерв в месяц, asset-строка. */
  amount: string;
  /** Подано заявлений за текущий месяц (поданные, одобренные, выплаченные), asset-строка. */
  submitted: string;
  /** Остаток резерва на месяц, asset-строка. */
  remaining: string;
}

export interface MarketplaceBranchReservesView {
  braname: string;
  /** Потолок резерва на получателя в месяц, asset-строка; ноль — резерв выключен. */
  limit: string;
  rows: MarketplaceBranchReserveView[];
}

/** Настройки экономики Стола заказов для стола администратора. */
export interface MarketplaceEconomySettingsView {
  membership_fee_percent: number;
  initiator_share_percent: number;
  /** Потолок резерва на получателя в месяц, asset-строка. */
  aid_month_limit: string;
  /** Сумма процентов фондов накопления кооператива, проценты. */
  funds_percent: number;
  /** Фонды накопления по отдельности: название, процент, имя разреза кошелька. */
  funds: MarketplaceAccumulationFundView[];
}

/** Инициатор участка — получатель доли экономии месяца и остаток его паевого кошелька. */
export interface MarketplaceBranchInitiatorView {
  username: string | null;
  /** Назначен отдельно от председателя участка. */
  assigned: boolean;
  /** Остаток `w.mkt.invest` инициатора, asset-строка. */
  invest_balance: string;
}

/** Фонд накопления кооператива для чтения на столе администратора. */
export interface MarketplaceAccumulationFundView {
  name: string;
  /** Процент отчисления, проценты. */
  percent: number;
  /** Кошелёк ledger2 фонда на счёте 86 — кошелёк и есть субсчёт фонда (задача 99D-25). */
  wallet_name: string;
}

/**
 * Резерв социально-экономического обеспечения пайщиков и настройки модели
 * (задача 99D-22, КЭУ-4; документ модели, разделы 5, 6, 12).
 *
 * Резерв ведёт контракт branch (таблица `reserves`, потолок `brnconfig`);
 * здесь — чтение для столов, проверка роли председателя участка до отправки и
 * предварительная проверка предела материальной помощи: контракт держит то же
 * правило за тот же период (`aidPeriodKey`), ИСТОК показывает отказ до
 * обращения в цепь. Суммы резерва называет председатель — это
 * допустимый случай суммы-аргумента.
 */
/** Паевой кошелёк инициатора участка (ledger2, счёт 80). */
const INVEST_WALLET = 'w.mkt.invest';

/**
 * Номер периода предела материальной помощи — тот же, что считает контракт
 * (`Branch::aid_period`): при длине периода в настройках участков — номер
 * отрезка этой длины от эпохи, иначе календарный месяц UTC (год × 12 + месяц).
 */
export function aidPeriodKey(config: BranchContract.Tables.BranchConfig.IBranchConfig | null, now: Date): number {
  const seconds = Number(config?.aid_period_seconds ?? 0);
  if (seconds > 0) return Math.floor(now.getTime() / 1000 / seconds);
  return now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
}

/** Границы периода материальной помощи, идущего в момент `now`: отрезок стенда либо календарный месяц UTC. */
export function aidPeriodBounds(config: BranchContract.Tables.BranchConfig.IBranchConfig | null, now: Date): { start: Date; end: Date } {
  const seconds = Number(config?.aid_period_seconds ?? 0);
  if (seconds > 0) {
    const key = Math.floor(now.getTime() / 1000 / seconds);
    return { start: new Date(key * seconds * 1000), end: new Date((key + 1) * seconds * 1000) };
  }
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

@Injectable()
export class MarketplaceBranchReserveService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MarketplaceBranchReserveService.name);

  constructor(
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly aidMirror: MarketplaceBranchAidMirrorService
  ) {}

  /**
   * Длина периода предела материальной помощи в цепи совпадает со временем
   * узла (решение владельца 09.11.2026): стенд со сжатым временем ставит длину
   * своего месяца, рабочий узел — ноль (календарный месяц). Пишется только при
   * расхождении; отказ цепи запуск не роняет — предел тогда живёт по прежней
   * длине, в журнале предупреждение.
   */
  async onApplicationBootstrap(): Promise<void> {
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    try {
      await this.syncAidPeriod(coopname);
    } catch (e) {
      this.logger.warn(`длина периода материальной помощи не записана: ${(e as Error)?.message ?? e}`);
    }
  }

  async syncAidPeriod(coopname: string): Promise<boolean> {
    const desired = standMonthSeconds();
    const config = await this.chainPort.getBranchConfig(coopname);
    if (Number(config?.aid_period_seconds ?? 0) === desired) return false;
    await this.chainPort.setAidPeriod({ coopname, seconds: desired });
    this.logger.log(`длина периода материальной помощи: ${desired > 0 ? `${desired} с` : 'календарный месяц'}`);
    return true;
  }

  // ── Настройки администратора ───────────────────────────────────────────

  async getSettings(coopname: string): Promise<MarketplaceEconomySettingsView> {
    const [config, branchConfig, funds, feePercent] = await Promise.all([
      this.chainPort.getEconomyConfig(coopname),
      this.chainPort.getBranchConfig(coopname),
      this.chainPort.listAccumulationFunds(coopname),
      this.economyService.getMembershipFeePercent(coopname),
    ]);
    const initiator = config?.initiator_share_percent ?? DEFAULT_INITIATOR_SHARE_PERCENT;
    const fundsPercent = funds.reduce((sum, f) => sum + Number(f.percent), 0);
    return {
      membership_fee_percent: feePercent,
      initiator_share_percent: this.toHumanPercent(initiator),
      aid_month_limit: branchConfig?.aid_month_limit ?? this.economyService.unitsToAsset(0n),
      funds_percent: this.toHumanPercent(fundsPercent),
      funds: funds.map((f) => ({
        name: String(f.name),
        percent: this.toHumanPercent(Number(f.percent)),
        wallet_name: String(f.wallet),
      })),
    };
  }

  async setInitiatorShare(coopname: string, percentHuman: number): Promise<number> {
    const initiator_share_percent = this.toContractPercent(percentHuman, i18nT('marketplace.economy.initiatorShareLabel'));
    try {
      await this.chainPort.setShares({ coopname, initiator_share_percent });
    } catch (e) {
      rethrowChainError(e);
    }
    return this.toHumanPercent(initiator_share_percent);
  }

  async setAidLimit(coopname: string, amountHuman: number): Promise<string> {
    if (!Number.isFinite(amountHuman) || amountHuman < 0) {
      throw DomainError.badRequest('MARKETPLACE_AID_LIMIT_INVALID');
    }
    const limit = this.economyService.unitsToAsset(this.economyService.assetToUnits(amountHuman.toFixed(4)));
    try {
      await this.chainPort.setAidLimit({ coopname, limit });
    } catch (e) {
      rethrowChainError(e);
    }
    return limit;
  }

  /** Инициатор участка; пустое имя снимает назначение, и получателем доли снова становится председатель. */
  async setBranchInitiator(coopname: string, braname: string, username: string | null): Promise<string | null> {
    try {
      await this.chainPort.setInitiator({ coopname, braname, username: username ?? '' });
    } catch (e) {
      rethrowChainError(e);
    }
    return username;
  }

  /** Получатель доли инициатора участка сегодня: назначенный либо председатель участка. */
  async getBranchInitiator(coopname: string, braname: string): Promise<MarketplaceBranchInitiatorView> {
    const assigned = await this.chainPort.getInitiator(coopname, braname);
    const username = assigned ? assigned.username : await this.kuChairmanService.getTrusteeOfBranch(coopname, braname);
    // Паевой кошелёк инициатора `w.mkt.invest` — его остаток показывает экономика
    // участка; у пайщика без отчислений строки кошелька ещё нет.
    const invest = username ? (await this.chainPort.getUserWallet(coopname, INVEST_WALLET, username))?.available : undefined;
    return {
      username,
      assigned: Boolean(assigned),
      invest_balance: invest ? String(invest) : this.economyService.unitsToAsset(0n),
    };
  }

  // ── Резерв участка ─────────────────────────────────────────────────────

  /**
   * Строки резерва участка (задача 99D-34): сумма в месяц, подано в текущем
   * периоде и доступно — накопленное право получателя, как его считает
   * контракт (`Branch::outstanding_of`, эталон `PeriodModel.reserveRight`).
   */
  async getReserves(coopname: string, braname: string, now = new Date()): Promise<MarketplaceBranchReservesView> {
    const [rows, branchConfig] = await Promise.all([
      this.chainPort.listBranchReserves(coopname, braname),
      this.chainPort.getBranchConfig(coopname),
    ]);
    const period = aidPeriodKey(branchConfig, now);
    const bounds = aidPeriodBounds(branchConfig, now);
    const views: MarketplaceBranchReserveView[] = [];
    for (const r of rows) {
      const submitted = await this.aidMirror.submittedWithin(coopname, String(r.username), bounds.start, bounds.end);
      views.push({
        username: r.username,
        amount: this.economyService.unitsToAsset(this.economyService.assetToUnits(String(r.amount))),
        submitted: this.economyService.unitsToAsset(submitted),
        remaining: this.economyService.unitsToAsset(await this.rightOf(coopname, r, period)),
      });
    }
    return {
      braname,
      limit: branchConfig?.aid_month_limit ?? this.economyService.unitsToAsset(0n),
      rows: views,
    };
  }

  /** Строка резерва получателя; подаёт председатель участка, получатель — председатель или доверенное лицо. */
  async setReserve(coopname: string, braname: string, username: string, amountHuman: number): Promise<void> {
    if (!Number.isFinite(amountHuman) || amountHuman <= 0) {
      throw DomainError.badRequest('MARKETPLACE_RESERVE_AMOUNT_INVALID');
    }
    const isRecipient = await this.kuChairmanService.isMemberOfBranch(coopname, braname, username);
    if (!isRecipient) throw DomainError.badRequest('MARKETPLACE_RESERVE_RECIPIENT_NOT_TRUSTED');
    const amount = this.economyService.unitsToAsset(this.economyService.assetToUnits(amountHuman.toFixed(4)));
    try {
      await this.chainPort.setReserve({ coopname, braname, username, amount });
    } catch (e) {
      rethrowChainError(e);
    }
  }

  async deleteReserve(coopname: string, braname: string, username: string): Promise<void> {
    try {
      await this.chainPort.deleteReserve({ coopname, braname, username });
    } catch (e) {
      rethrowChainError(e);
    }
  }

  /**
   * Предварительная проверка предела материальной помощи — то же правило, что
   * в `createaid` контракта: при потолке больше нуля у получателя есть резерв
   * на участке, и сумма заявления не выше его накопленного права (задача 99D-34).
   */
  async assertAidWithinReserve(coopname: string, braname: string, username: string, amountHuman: number, now = new Date()): Promise<void> {
    const branchConfig = await this.chainPort.getBranchConfig(coopname);
    const limit = this.economyService.assetToUnits(branchConfig?.aid_month_limit ?? '0');
    if (limit <= 0n) return;
    const reserve = (await this.chainPort.listBranchReserves(coopname, braname)).find((r) => r.username === username);
    if (!reserve) throw DomainError.badRequest('MARKETPLACE_AID_NO_RESERVE');
    const available = await this.rightOf(coopname, reserve, aidPeriodKey(branchConfig, now));
    const requested = this.economyService.assetToUnits(amountHuman.toFixed(4));
    if (requested > available) {
      throw DomainError.badRequest('MARKETPLACE_AID_OVER_RESERVE', {
        requested: this.economyService.unitsToAsset(requested),
        available: this.economyService.unitsToAsset(available),
      });
    }
  }

  /**
   * Накопленное право получателей помощи участка на следующий период —
   * слагаемое цели резерва, которое соберёт итог текущего месяца (так же
   * считает `closeperiod`: `Branch::sum_outstanding` на период + 1).
   */
  async rightNextPeriod(coopname: string, braname: string, now = new Date()): Promise<bigint> {
    const [rows, branchConfig] = await Promise.all([
      this.chainPort.listBranchReserves(coopname, braname),
      this.chainPort.getBranchConfig(coopname),
    ]);
    const next = aidPeriodKey(branchConfig, now) + 1;
    let total = 0n;
    for (const row of rows) total += await this.rightOf(coopname, row, next);
    return total;
  }

  /**
   * Накопленное право получателя на период `period` по строке резерва цепи.
   * Строка до 99D-34 полей права не имеет: её право — сумма строки минус
   * поданное за период по накопителю контракта `branch::aidmonths`.
   */
  private async rightOf(coopname: string, row: BranchContract.Tables.Reserves.IBranchReserve, period: number): Promise<bigint> {
    const amount = this.economyService.assetToUnits(String(row.amount));
    if (row.accrued_period === undefined || row.accrued_period === null || !row.outstanding) {
      const month = await this.chainPort.getAidMonth(coopname, String(row.username));
      const used = month && Number(month.period) === period ? this.economyService.assetToUnits(String(month.total)) : 0n;
      return MarketContract.PeriodModel.reserveRight({ amount }, period, used);
    }
    return MarketContract.PeriodModel.reserveRight(
      { amount, accruedPeriod: Number(row.accrued_period), outstanding: this.economyService.assetToUnits(String(row.outstanding)) },
      period
    );
  }

  private toContractPercent(human: number, label: string): number {
    if (!Number.isFinite(human) || human < 0 || human > 100) {
      throw DomainError.badRequest('MARKETPLACE_ECONOMY_PERCENT_OUT_OF_RANGE', { label });
    }
    return Math.round((human * HUNDR_PERCENTS) / 100);
  }

  private toHumanPercent(contractValue: number | string): number {
    return (Number(contractValue) * 100) / HUNDR_PERCENTS;
  }
}
