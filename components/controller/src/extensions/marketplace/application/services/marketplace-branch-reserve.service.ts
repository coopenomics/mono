import { Inject, Injectable } from '@nestjs/common';
import { DomainError, rethrowChainError } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';
import { MarketplaceKuChairmanService } from './marketplace-ku-chairman.service';
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
 * правило по месяцу UTC, ИСТОК показывает отказ до обращения в цепь по
 * часовому поясу кооператива. Суммы резерва называет председатель — это
 * допустимый случай суммы-аргумента.
 */
/** Паевой кошелёк инициатора участка (ledger2, счёт 80). */
const INVEST_WALLET = 'w.mkt.invest';

@Injectable()
export class MarketplaceBranchReserveService {
  constructor(
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

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

  async getReserves(coopname: string, braname: string, now = new Date()): Promise<MarketplaceBranchReservesView> {
    const [rows, branchConfig] = await Promise.all([
      this.chainPort.listBranchReserves(coopname, braname),
      this.chainPort.getBranchConfig(coopname),
    ]);
    const views: MarketplaceBranchReserveView[] = [];
    for (const r of rows) {
      const amount = this.economyService.assetToUnits(String(r.amount));
      const submitted = await this.submittedThisMonth(coopname, r.username, now);
      const remaining = amount > submitted ? amount - submitted : 0n;
      views.push({
        username: r.username,
        amount: this.economyService.unitsToAsset(amount),
        submitted: this.economyService.unitsToAsset(submitted),
        remaining: this.economyService.unitsToAsset(remaining),
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
   * на участке, и сумма заявлений за месяц не выше резерва. Поданное — из
   * накопителя контракта, тот же календарный месяц по UTC, что в `createaid`.
   */
  async assertAidWithinReserve(coopname: string, braname: string, username: string, amountHuman: number, now = new Date()): Promise<void> {
    const branchConfig = await this.chainPort.getBranchConfig(coopname);
    const limit = this.economyService.assetToUnits(branchConfig?.aid_month_limit ?? '0');
    if (limit <= 0n) return;
    const reserve = (await this.chainPort.listBranchReserves(coopname, braname)).find((r) => r.username === username);
    if (!reserve) throw DomainError.badRequest('MARKETPLACE_AID_NO_RESERVE');
    const submitted = await this.submittedThisMonth(coopname, username, now);
    const requested = this.economyService.assetToUnits(amountHuman.toFixed(4));
    const reserveUnits = this.economyService.assetToUnits(String(reserve.amount));
    if (submitted + requested > reserveUnits) {
      throw DomainError.badRequest('MARKETPLACE_AID_OVER_RESERVE', {
        requested: this.economyService.unitsToAsset(requested),
        submitted: this.economyService.unitsToAsset(submitted),
        reserve: this.economyService.unitsToAsset(reserveUnits),
      });
    }
  }

  /**
   * Материальная помощь, поданная получателем в текущем месяце, — из
   * накопителя контракта `branch::aidmonths`. Контракт ведёт его по
   * календарному месяцу UTC (год × 12 + месяц) и по нему отказывает
   * «превысит резерв»; стол показывает то же число. Прежний расчёт по месяцу
   * стенда со сжатым временем расходился с контрактом (владелец 08.11.2026).
   */
  private async submittedThisMonth(coopname: string, username: string, now: Date): Promise<bigint> {
    const row = await this.chainPort.getAidMonth(coopname, username);
    if (!row) return 0n;
    const period = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
    return Number(row.period) === period ? this.economyService.assetToUnits(String(row.total)) : 0n;
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
