import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BranchContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { TableStore, moreOrEqual } from '@coopenomics/extension-kit';
import { MARKETPLACE_BRANCH_AID_STORE } from '../../infrastructure/database/marketplace-stores';
import { MarketplaceBranchAidEntity, MarketplaceBranchAidStatus } from '../../infrastructure/entities/marketplace-branch-aid.entity';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';

const BRANCH = BranchContract.contractName.production;

/**
 * Зеркало заявлений на материальную помощь участка (задача 99D-22, КЭУ-4).
 *
 * Строка цепи `branch::aids` стирается при подтверждении выплаты и при отказе
 * совета, а итогу месяца участка нужна сумма помощи, выплаченной за месяц по
 * участку заявления. Зеркало ведётся по действиям контракта branch, а не по
 * операциям ledger2: у операций `o.brn.aid` нет участка. Хэш заявления равен
 * хэшу исходящего платежа (`aidconfirm.outcome_hash`) и хэшу процесса.
 *
 * Суммы — из аргументов действия, узел их не считает. Повтор события
 * безопасен: создание идемпотентно по хэшу, переходы состояния только вперёд.
 */
@Injectable()
export class MarketplaceBranchAidMirrorService {
  constructor(
    @Inject(MARKETPLACE_BRANCH_AID_STORE)
    private readonly store: TableStore<MarketplaceBranchAidEntity>,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceBranchAidMirrorService.name);
  }

  @OnEvent(`action::${BRANCH}::${BranchContract.Actions.CreateAid.actionName}`)
  async onCreateAid(action: InnerChainActionRecord): Promise<void> {
    await this.safely(action, () => this.created(action));
  }

  @OnEvent(`action::${BRANCH}::${BranchContract.Actions.OnAidAuth.actionName}`)
  async onAidAuth(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as BranchContract.Actions.OnAidAuth.IOnaidauth;
    await this.safely(action, () => this.advance(String(data.hash), MarketplaceBranchAidStatus.APPROVED, null));
  }

  @OnEvent(`action::${BRANCH}::${BranchContract.Actions.AidConfirm.actionName}`)
  async onAidConfirm(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as BranchContract.Actions.AidConfirm.IAidconfirm;
    const paidAt = action.block_time ? new Date(action.block_time) : new Date();
    await this.safely(action, () => this.advance(String(data.outcome_hash), MarketplaceBranchAidStatus.PAID, paidAt));
  }

  @OnEvent(`action::${BRANCH}::${BranchContract.Actions.OnAidDecl.actionName}`)
  async onAidDecl(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as BranchContract.Actions.OnAidDecl.IOnaiddecl;
    await this.safely(action, () => this.advance(String(data.hash), MarketplaceBranchAidStatus.DECLINED, null));
  }

  /** Создание строки по действию `createaid`; повтор события строку не трогает. */
  async created(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as BranchContract.Actions.CreateAid.ICreateaid;
    const aid_hash = String(data.aid_hash).toLowerCase();
    if (await this.store.findOne({ aid_hash })) return;
    await this.store.insert({
      aid_hash,
      coopname: String(data.coopname),
      braname: String(data.braname),
      username: String(data.username),
      amount: this.toDecimal(String(data.amount)),
      status: MarketplaceBranchAidStatus.PROPOSED,
      paid_at: null,
      created_at: action.block_time ? new Date(action.block_time) : new Date(),
    });
  }

  /** Переход состояния только вперёд: выплаченное и отклонённое не переписываются. */
  async advance(hash: string, status: MarketplaceBranchAidStatus, paidAt: Date | null): Promise<void> {
    const aid_hash = hash.toLowerCase();
    const row = await this.store.findOne({ aid_hash });
    if (!row) {
      this.logger.warn(`Зеркало материальной помощи: заявление ${aid_hash} не найдено — переход в «${status}» не учтён.`);
      return;
    }
    if (row.status === MarketplaceBranchAidStatus.PAID || row.status === MarketplaceBranchAidStatus.DECLINED) return;
    await this.store.update({ aid_hash }, { status, paid_at: paidAt ?? row.paid_at });
  }

  /**
   * Хэш — заявление на материальную помощь (задача 99D-30). Выделение средств
   * инициаторов идёт одной операцией и под служебную записку, и под помощь;
   * помощь в итоге месяца считается как МП, поэтому её выделение не входит в СЗ.
   */
  async isAidHash(coopname: string, hash: string): Promise<boolean> {
    return (await this.store.findOne({ coopname, aid_hash: hash.toLowerCase() })) !== null;
  }

  /** Материальная помощь участка, выплаченная за отрезок времени [from, to). Сумма заявлений целиком, с налогом. */
  async paidWithin(coopname: string, braname: string, from: Date, to: Date): Promise<bigint> {
    return (await this.paidRowsWithin(coopname, braname, from, to)).reduce((sum, r) => sum + r.amount, 0n);
  }

  /**
   * Заявления участка, выплаченные за отрезок [from, to): хэш и сумма целиком.
   * Итогу месяца нужно отделить помощь из средств инициаторов (задача 99D-34):
   * источник виден по операциям нитки заявления, поэтому отдаётся и хэш.
   */
  async paidRowsWithin(coopname: string, braname: string, from: Date, to: Date): Promise<Array<{ hash: string; amount: bigint }>> {
    // Отбор по дате делает база: строк за все прошлые месяцы узел не читает.
    const rows = await this.store.find({ coopname, braname, status: MarketplaceBranchAidStatus.PAID, paid_at: moreOrEqual(from) });
    return rows
      .filter((r) => r.paid_at && r.paid_at < to)
      .map((r) => ({ hash: r.aid_hash, amount: this.fromDecimal(r.amount) }));
  }

  /**
   * Сколько получатель уже подал за отрезок времени: поданные, одобренные и
   * выплаченные заявления — все они занимают предел материальной помощи.
   */
  async submittedWithin(coopname: string, username: string, from: Date, to: Date): Promise<bigint> {
    const rows = await this.store.find({ coopname, username, created_at: moreOrEqual(from) });
    return rows
      .filter((r) => r.status !== MarketplaceBranchAidStatus.DECLINED && r.created_at < to)
      .reduce((sum, r) => sum + this.fromDecimal(r.amount), 0n);
  }

  private async safely(action: InnerChainActionRecord, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (err: any) {
      this.logger.error(`Зеркало материальной помощи: действие ${action.name} ${action.global_sequence} не учтено (${err.message})`, err.stack);
    }
  }

  private toDecimal(asset: string): string {
    return this.economyService.unitsToAsset(this.economyService.assetToUnits(asset)).split(' ')[0] ?? '0';
  }

  private fromDecimal(value: string | null | undefined): bigint {
    return this.economyService.assetToUnits(String(value ?? '0'));
  }
}
