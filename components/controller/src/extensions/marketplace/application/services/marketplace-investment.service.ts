import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { MarketContract } from 'cooptypes';
import { Registry } from '@coopenomics/docs-templates';
import {
  ACCOUNT_PORT,
  DOCUMENT_PORT,
  LEDGER2_HISTORY_PORT,
  LOGGER_PORT,
  SOVIET_ROBOT_PORT,
  type IAccountPort,
  type IDocumentPort,
  type ILedger2HistoryPort,
  type ILoggerPort,
  type ISovietRobotPort,
  type InnerGeneratedDocument,
} from '@coopenomics/innercoop';
import { DomainError, SignedDigitalDocumentInputDTO, rethrowChainError, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import { MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT, type MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';
import { MarketplaceKuChairmanService } from './marketplace-ku-chairman.service';
import { t } from '../../i18n';

const { crpsClaimable, crpsOutstanding } = MarketContract.PeriodModel;

/** Кошелёк договора участия инициатора в ledger2 (счёт 80). */
const INVEST_WALLET = 'w.mkt.invest';
/** Тип решения совета о приёме имущества в участок. */
const DECISION_TYPE = 'mktiprop';

/** Статус строки инициатора в контракте (`investors.status`). */
export enum MarketplaceInvestorStatus {
  ACTIVE = 'active',
  DONE = 'done',
}

/** Этап заявления о паевом взносе имуществом в контракте (`invprops.status`). */
export enum MarketplaceInvestPropertyStatus {
  /** Заявление подано. */
  CREATED = 'created',
  /** Председатель участка одобрил, вопрос в совете. */
  APPROVED = 'approved',
  /** Совет принял решение, вносящий подписывает акт. */
  AUTHORIZED = 'authorized',
  /** Акт ждёт подписи председателя участка. */
  ACT1 = 'act1',
}

/** Фаза участка по паевым взносам инициаторов (задача 99D-30, PRD «Фазы»). */
export enum MarketplaceInvestPhase {
  /** У участка нет паевых взносов инициаторов. */
  NONE = 'NONE',
  /** Паевые взносы есть, из экономии участка ещё ничего не возмещено. */
  FUNDING = 'FUNDING',
  /** Доля инициаторов возмещает их паевые взносы. */
  RETURNING = 'RETURNING',
  /** Использованное возмещено целиком: доля инициаторов направляется участку. */
  RETURNED = 'RETURNED',
}

/** Вид записи истории паевых взносов пайщика — по операции учёта. */
export enum MarketplaceInvestHistoryKind {
  /** Паевой взнос деньгами по заявлению 1119. */
  MONEY = 'MONEY',
  /** Имущество принято по акту 1122. */
  PROPERTY = 'PROPERTY',
  /** Трансляция в Цифровой Кошелёк по заявлению 1123. */
  CLAIM = 'CLAIM',
  /** Остаток перенесён на главный паевой кошелёк при выходе из кооператива. */
  EXIT = 'EXIT',
}

/** Операции ledger2, из которых складывается история паевых взносов пайщика. */
const HISTORY_OPERATIONS: Readonly<Record<string, MarketplaceInvestHistoryKind>> = {
  'o.mkt.inv': MarketplaceInvestHistoryKind.MONEY,
  'o.mkt.iprop': MarketplaceInvestHistoryKind.PROPERTY,
  'o.mkt.iback': MarketplaceInvestHistoryKind.CLAIM,
  'o.mkt.iexit': MarketplaceInvestHistoryKind.EXIT,
};

/** Запись истории паевых взносов. `process_hash` — хэш процесса: по нему находится документ в реестре. */
export interface MarketplaceInvestHistoryEntryView {
  kind: MarketplaceInvestHistoryKind;
  amount: bigint;
  process_hash: string;
  created_at: Date;
  global_sequence: string;
}

/** Строка инициатора по участку для столов. Суммы — в единицах актива. */
export interface MarketplaceInvestorView {
  braname: string;
  username: string;
  active: boolean;
  money: bigint;
  property: bigint;
  used: bigint;
  returned: bigint;
  claimed: bigint;
  /** Доступно к заявлению о трансляции — предпросмотр по формуле контракта. */
  claimable: bigint;
  /** Деньги, ещё не израсходованные участком (запас на дефицитные месяцы). */
  unused: bigint;
}

/** Паевые взносы участка для столов. Суммы — в единицах актива. */
export interface MarketplaceInvestBranchView {
  braname: string;
  phase: MarketplaceInvestPhase;
  money_total: bigint;
  property_total: bigint;
  unused_total: bigint;
  reserved: bigint;
  spent_total: bigint;
  repaid_total: bigint;
  outstanding: bigint;
  investors: MarketplaceInvestorView[];
  properties: MarketContract.Tables.InvProps.IMktInvProp[];
}

/** Поля заявления на имущество, которые называет вносящий. */
export interface MarketplaceInvestPropertyFields {
  property_name: string;
  property_description: string;
  property_quantity: string;
  property_unit: string;
  /** Цена приёма, рубли. */
  amount: number;
}

const units = (asset: unknown, economy: MarketplaceEconomyService): bigint => economy.assetToUnits(String(asset ?? '0'));

/**
 * Инвестиционный этап кооперативного участка Стола заказов — ИСТОК
 * (задача 99D-30, PRD компонента 68).
 *
 * Сервис генерирует документы договора участия, паевые взносы деньгами и
 * имуществом и заявления обратно (фабрика 1118–1123), отправляет действия
 * контракта marketplace и читает его таблицы по индексу. Денежных расчётов
 * здесь нет: суммы паевых взносов называет пайщик, а доступное для трансляции считает
 * контракт; `previewClaim` повторяет его формулу для показа (эталон
 * `MarketContract.PeriodModel.crpsClaimable`).
 */
@Injectable()
export class MarketplaceInvestmentService {
  constructor(
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(MARKETPLACE_ECONOMY_SERVICE) private readonly economyService: MarketplaceEconomyService,
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Optional()
    @Inject(SOVIET_ROBOT_PORT)
    private readonly robotPort: ISovietRobotPort | null | undefined,
    @Inject(LEDGER2_HISTORY_PORT) private readonly ledger2History: ILedger2HistoryPort
  ) {
    this.logger.setContext(MarketplaceInvestmentService.name);
  }

  // ── Договор участия ────────────────────────────────────────────────────

  /** Номер договора — короткий отпечаток пайщика в кооперативе: один договор на пайщика. */
  agreementNumber(coopname: string, username: string): string {
    return createHash('sha256').update(`${coopname}:${username}:invest`).digest('hex').slice(0, 8).toUpperCase();
  }

  async getAgreement(coopname: string, username: string): Promise<{ number: string; signed_at: string } | null> {
    const row = await this.chainPort.getInvestAgreement(coopname, username);
    return row ? { number: this.agreementNumber(coopname, username), signed_at: String(row.signed_at) } : null;
  }

  async generateAgreement(coopname: string, username: string): Promise<InnerGeneratedDocument> {
    const data: Registry.MarketplaceInvestAgreement.Action = {
      registry_id: Registry.MarketplaceInvestAgreement.registry_id,
      coopname,
      username,
      lang: 'ru',
      agreement_number: this.agreementNumber(coopname, username),
      skip_save: false,
    };
    return this.documentPort.generate({ data });
  }

  async signAgreement(coopname: string, username: string, signed: SignedDigitalDocumentInputDTO): Promise<void> {
    await this.submit(() =>
      this.chainPort.signInvestAgreement({
        coopname,
        username,
        agreement: new SignedDigitalDocumentInputDTO(signed).toDocument() as MarketContract.Actions.SignInvAgr.ISignInvAgr['agreement'],
      })
    );
  }

  // ── Паевой взнос деньгами ──────────────────────────────────────────────────

  async generateInvestStatement(coopname: string, username: string, braname: string, amount: number): Promise<InnerGeneratedDocument> {
    const agreement = await this.requireAgreement(coopname, username);
    const data: Registry.MarketplaceInvestStatement.Action = {
      registry_id: Registry.MarketplaceInvestStatement.registry_id,
      coopname,
      username,
      lang: 'ru',
      invest_hash: this.newHash(),
      braname,
      branch_name: await this.branchName(braname),
      amount: this.toAsset(amount),
      agreement_number: agreement.number,
      agreement_created_at: this.dateOf(agreement.signed_at),
      skip_save: false,
    };
    return this.documentPort.generate({ data });
  }

  async investMoney(coopname: string, username: string, braname: string, investHash: string, amount: number, signed: SignedDigitalDocumentInputDTO): Promise<void> {
    await this.requireOperator(coopname, braname, username);
    await this.submit(() =>
      this.chainPort.investMoney({
        coopname,
        username,
        braname,
        invest_hash: investHash,
        amount: this.toAsset(amount),
        statement: new SignedDigitalDocumentInputDTO(signed).toDocument() as MarketContract.Actions.InvestMoney.IInvestMoney['statement'],
      })
    );
  }

  // ── Паевой взнос имуществом ───────────────────────────────────────────────

  async generatePropertyStatement(
    coopname: string,
    username: string,
    braname: string,
    fields: MarketplaceInvestPropertyFields,
    propertyHash = this.newHash()
  ): Promise<InnerGeneratedDocument> {
    const agreement = await this.requireAgreement(coopname, username);
    const data: Registry.MarketplaceInvestPropertyStatement.Action = {
      registry_id: Registry.MarketplaceInvestPropertyStatement.registry_id,
      coopname,
      username,
      lang: 'ru',
      braname,
      branch_name: await this.branchName(braname),
      branch_chairman_name: await this.chairmanName(coopname, braname),
      agreement_number: agreement.number,
      agreement_created_at: this.dateOf(agreement.signed_at),
      property_hash: propertyHash,
      property_form: 'thing',
      property_name: fields.property_name,
      property_description: fields.property_description,
      property_quantity: fields.property_quantity,
      property_unit: fields.property_unit,
      property_amount: this.toAsset(fields.amount),
      skip_save: false,
    };
    return this.documentPort.generate({ data });
  }

  async createProperty(
    coopname: string,
    username: string,
    braname: string,
    propertyHash: string,
    fields: MarketplaceInvestPropertyFields,
    signed: SignedDigitalDocumentInputDTO
  ): Promise<void> {
    await this.requireOperator(coopname, braname, username);
    await this.submit(() =>
      this.chainPort.createInvestProperty({
        coopname,
        username,
        braname,
        property_hash: propertyHash,
        amount: this.toAsset(fields.amount),
        description: `${fields.property_name}, ${fields.property_quantity} ${fields.property_unit}: ${fields.property_description}`,
        statement: new SignedDigitalDocumentInputDTO(signed).toDocument() as MarketContract.Actions.CreateIProp.ICreateIProp['statement'],
      })
    );
  }

  /**
   * Одобрение — то же заявление 1120 с подписью председателя участка. Документ
   * собирается заново из данных поданного заявления (они лежат в его мете).
   */
  async generatePropertyApproval(coopname: string, propertyHash: string): Promise<InnerGeneratedDocument> {
    const prop = await this.requireProperty(coopname, propertyHash);
    const meta = this.statementMeta(prop);
    return this.generatePropertyStatement(coopname, prop.username, prop.braname, meta, prop.hash);
  }

  async approveProperty(coopname: string, braname: string, propertyHash: string, signed: SignedDigitalDocumentInputDTO): Promise<void> {
    await this.submit(() =>
      this.chainPort.approveInvestProperty({
        coopname,
        braname,
        property_hash: propertyHash,
        approved_statement: new SignedDigitalDocumentInputDTO(signed).toDocument() as MarketContract.Actions.ApproveIProp.IApproveIProp['approved_statement'],
        meta: JSON.stringify({ registry_id: Registry.MarketplaceInvestPropertyStatement.registry_id, property_hash: propertyHash, braname }),
      })
    );
    await this.requestRobot(coopname, braname, propertyHash);
  }

  async declineProperty(coopname: string, braname: string, propertyHash: string, reason: string): Promise<void> {
    await this.submit(() => this.chainPort.declineInvestProperty({ coopname, braname, property_hash: propertyHash, reason }));
  }

  /** Акт 1122 к подписи: вносящему первой подписью, председателю участка — второй, тот же документ. */
  async generatePropertyAct(coopname: string, propertyHash: string): Promise<InnerGeneratedDocument> {
    const prop = await this.requireProperty(coopname, propertyHash);
    const decision = await this.chainPort.findCouncilDecisionByHash(coopname, propertyHash);
    if (!decision) throw DomainError.badRequest('MARKETPLACE_IPROP_DECISION_MISSING');
    const meta = this.statementMeta(prop);
    const agreement = await this.requireAgreement(coopname, prop.username);
    const data: Registry.MarketplaceInvestPropertyAct.Action = {
      registry_id: Registry.MarketplaceInvestPropertyAct.registry_id,
      coopname,
      username: prop.username,
      lang: 'ru',
      decision_id: Number(decision.id),
      braname: prop.braname,
      branch_name: await this.branchName(prop.braname),
      branch_chairman_name: await this.chairmanName(coopname, prop.braname),
      agreement_number: agreement.number,
      agreement_created_at: this.dateOf(agreement.signed_at),
      property_hash: prop.hash,
      property_form: 'thing',
      property_name: meta.property_name,
      property_description: meta.property_description,
      property_quantity: meta.property_quantity,
      property_unit: meta.property_unit,
      property_amount: String(prop.amount),
      skip_save: false,
    };
    const doc = await this.documentPort.generate({ data });
    // Акт подписан вносящим: председатель участка подписывает тот же документ —
    // хэш и мета берутся из акта в цепи (контракт сверяет хэш). Текст для
    // показа собран заново из тех же данных.
    const act = prop.status === MarketplaceInvestPropertyStatus.ACT1 ? prop.act : null;
    if (act?.doc_hash && act.meta) return { ...doc, hash: String(act.doc_hash), meta: JSON.parse(String(act.meta)) };
    return doc;
  }

  async signPropertyAct(
    coopname: string,
    signer: string,
    propertyHash: string,
    signed: SignedDigitalDocumentInputDTO,
    second: boolean
  ): Promise<void> {
    const prop = await this.requireProperty(coopname, propertyHash);
    const act = new SignedDigitalDocumentInputDTO(signed).toDocument() as MarketContract.Actions.Act1IProp.IAct1IProp['act'];
    if (second) {
      // Вторая подпись ложится на акт вносящего: подписи вносящего из цепи и
      // подпись председателя участка — в одном документе.
      if (!prop.act?.hash || String(prop.act.hash).toLowerCase() !== String(act.hash).toLowerCase()) {
        throw DomainError.badRequest('MARKETPLACE_IPROP_ACT_MISMATCH');
      }
      const own = new Set(prop.act.signatures.map((sig) => Number(sig.id)));
      const merged = { ...act, signatures: [...prop.act.signatures, ...act.signatures.filter((sig) => !own.has(Number(sig.id)))] };
      await this.submit(() => this.chainPort.signInvestPropertyAct2({ coopname, braname: prop.braname, property_hash: propertyHash, act: merged }));
    } else {
      await this.submit(() => this.chainPort.signInvestPropertyAct1({ coopname, username: signer, property_hash: propertyHash, act }));
    }
  }

  // ── Трансляция ───────────────────────────────────────────────────────

  /**
   * Предпросмотр: сколько инициатор вправе транслировать сейчас. Формула
   * контракта (`claimable_of`) плюс прежние начисления доли инициатора на
   * кошельке договора участия сверх строк паевых взносов. Показ, не расчёт: заявление
   * контракт пересчитывает сам.
   */
  async previewClaim(coopname: string, braname: string, username: string): Promise<bigint> {
    const [branch, rows, wallet] = await Promise.all([
      this.chainPort.getInvestBranch(coopname, braname),
      this.chainPort.listUserInvestments(coopname, username),
      this.chainPort.getUserWallet(coopname, INVEST_WALLET, username),
    ]);
    const row = rows.find((r) => r.braname === braname);
    if (!branch || !row) return 0n;
    const own = crpsClaimable(this.crpsBranch(branch), this.crpsInvestor(row)).total;
    const inRows = rows.reduce((sum, r) => sum + units(r.money, this.economyService) + units(r.property, this.economyService) - units(r.claimed, this.economyService), 0n);
    const legacy = units(wallet?.available, this.economyService) - inRows;
    return own + (legacy > 0n ? legacy : 0n);
  }

  async generateClaimStatement(coopname: string, username: string, braname: string): Promise<InnerGeneratedDocument> {
    const agreement = await this.requireAgreement(coopname, username);
    const amount = await this.previewClaim(coopname, braname, username);
    if (amount <= 0n) throw DomainError.badRequest('MARKETPLACE_INVEST_NOTHING_TO_CLAIM');
    const data: Registry.MarketplaceInvestClaimStatement.Action = {
      registry_id: Registry.MarketplaceInvestClaimStatement.registry_id,
      coopname,
      username,
      lang: 'ru',
      claim_hash: this.newHash(),
      braname,
      branch_name: await this.branchName(braname),
      amount: this.economyService.unitsToAsset(amount),
      agreement_number: agreement.number,
      agreement_created_at: this.dateOf(agreement.signed_at),
      skip_save: false,
    };
    return this.documentPort.generate({ data });
  }

  async claim(coopname: string, username: string, braname: string, claimHash: string, signed: SignedDigitalDocumentInputDTO): Promise<void> {
    await this.submit(() =>
      this.chainPort.claimInvestment({
        coopname,
        username,
        braname,
        claim_hash: claimHash,
        statement: new SignedDigitalDocumentInputDTO(signed).toDocument() as MarketContract.Actions.ClaimInv.IClaimInv['statement'],
      })
    );
  }

  // ── Представления для столов ──────────────────────────────────────────

  async getBranchInvestment(coopname: string, braname: string): Promise<MarketplaceInvestBranchView> {
    const [branch, investors, properties] = await Promise.all([
      this.chainPort.getInvestBranch(coopname, braname),
      this.chainPort.listBranchInvestors(coopname, braname),
      this.chainPort.listBranchInvestProperties(coopname, braname),
    ]);
    const crps = branch ? this.crpsBranch(branch) : null;
    return {
      braname,
      phase: this.phaseOf(branch, investors.length),
      money_total: units(branch?.money_total, this.economyService),
      property_total: units(branch?.property_total, this.economyService),
      unused_total: units(branch?.unused_total, this.economyService),
      reserved: units(branch?.reserved, this.economyService),
      spent_total: units(branch?.spent_total, this.economyService),
      repaid_total: units(branch?.repaid_total, this.economyService),
      outstanding: crps ? crpsOutstanding(crps) : 0n,
      investors: crps ? investors.map((r) => this.investorView(crps, r)) : [],
      properties,
    };
  }

  async listMyInvestments(coopname: string, username: string): Promise<MarketplaceInvestorView[]> {
    const rows = await this.chainPort.listUserInvestments(coopname, username);
    const views: MarketplaceInvestorView[] = [];
    for (const row of rows) {
      const branch = await this.chainPort.getInvestBranch(coopname, row.braname);
      if (branch) views.push(this.investorView(this.crpsBranch(branch), row));
    }
    return views;
  }

  /**
   * История паевых взносов пайщика по операциям учёта: деньги, принятое имущество,
   * трансляции и перенос при выходе — новые первыми. Участок в операции не
   * записан, его называет документ процесса (`process_hash`) в реестре.
   */
  async listMyHistory(coopname: string, username: string, options?: PaginationInputDTO): Promise<PaginationResult<MarketplaceInvestHistoryEntryView>> {
    const result = await this.ledger2History.getHistory({
      coopname,
      username,
      actionNames: ['apply'],
      operationCodes: Object.keys(HISTORY_OPERATIONS),
      page: options?.page ?? 1,
      limit: options?.limit ?? 20,
      sortOrder: 'DESC',
    });
    const items: MarketplaceInvestHistoryEntryView[] = [];
    for (const op of result.items) {
      const kind = op.operationCode ? HISTORY_OPERATIONS[op.operationCode] : undefined;
      if (!kind) continue;
      items.push({
        kind,
        amount: units(op.quantity, this.economyService),
        process_hash: String(op.processHash ?? '').toLowerCase(),
        created_at: op.createdAt,
        global_sequence: op.globalSequence,
      });
    }
    return { items, totalCount: result.totalCount, totalPages: result.totalPages, currentPage: result.currentPage };
  }

  /** Решение совета по имуществу: просим робота принять его сейчас; без робота — ждём совет. */
  private async requestRobot(coopname: string, braname: string, propertyHash: string): Promise<void> {
    if (!this.robotPort) return;
    try {
      if (!(await this.robotPort.isEnabled())) return;
      const decision = await this.chainPort.findCouncilDecisionByHash(coopname, propertyHash);
      if (!decision) return;
      const prop = await this.chainPort.getInvestProperty(coopname, propertyHash);
      const result = await this.robotPort.requestDecision({
        coopname,
        decision_id: Number(decision.id),
        decision_type: DECISION_TYPE,
        decision_hash: propertyHash,
        username: prop?.username ?? braname,
      });
      this.logger.log(`Имущество ${propertyHash.slice(0, 8)}: робот решений совета ответил «${result.outcome}».`);
    } catch (err) {
      // Робот — дело его сторожа; решение примут люди в повестке.
      this.logger.warn(`Имущество ${propertyHash.slice(0, 8)}: вызов робота не удался (${(err as Error)?.message ?? err}).`);
    }
  }

  private investorView(branch: MarketContract.PeriodModel.ICrpsBranch, row: MarketContract.Tables.Investors.IMktInvestor): MarketplaceInvestorView {
    const inv = this.crpsInvestor(row);
    const used = inv.usedMoney + inv.property;
    let returned = MarketContract.PeriodModel.crpsReturned(inv, branch.acc);
    if (returned > used) returned = used;
    return {
      braname: row.braname,
      username: row.username,
      active: inv.active,
      money: inv.money,
      property: inv.property,
      used,
      returned,
      claimed: inv.claimed,
      claimable: crpsClaimable(branch, inv).total,
      unused: inv.money - inv.usedMoney,
    };
  }

  private phaseOf(branch: MarketContract.Tables.InvBranches.IMktInvBranch | null, investors: number): MarketplaceInvestPhase {
    if (!branch || investors === 0) return MarketplaceInvestPhase.NONE;
    if (BigInt(branch.base ?? 0) <= 0n) return units(branch.repaid_total, this.economyService) > 0n ? MarketplaceInvestPhase.RETURNED : MarketplaceInvestPhase.FUNDING;
    return units(branch.repaid_total, this.economyService) > 0n ? MarketplaceInvestPhase.RETURNING : MarketplaceInvestPhase.FUNDING;
  }

  private crpsBranch(b: MarketContract.Tables.InvBranches.IMktInvBranch): MarketContract.PeriodModel.ICrpsBranch {
    return {
      base: BigInt(b.base ?? 0),
      acc: BigInt(b.acc ?? 0),
      sJoin: BigInt(b.s_join ?? 0),
      sFixed: BigInt(b.s_fixed ?? 0),
      unusedTotal: units(b.unused_total, this.economyService),
      reserved: units(b.reserved, this.economyService),
    };
  }

  private crpsInvestor(r: MarketContract.Tables.Investors.IMktInvestor): MarketContract.PeriodModel.ICrpsInvestor {
    return {
      active: r.status === MarketplaceInvestorStatus.ACTIVE,
      money: units(r.money, this.economyService),
      property: units(r.property, this.economyService),
      usedMoney: units(r.used_money, this.economyService),
      claimed: units(r.claimed, this.economyService),
      returnedFixed: BigInt(r.returned_fixed ?? 0),
      accJoin: BigInt(r.acc_join ?? 0),
    };
  }

  private statementMeta(prop: MarketContract.Tables.InvProps.IMktInvProp): MarketplaceInvestPropertyFields {
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(String(prop.statement?.meta ?? '{}'));
    } catch {
      meta = {};
    }
    return {
      property_name: String(meta.property_name ?? prop.description),
      property_description: String(meta.property_description ?? prop.description),
      property_quantity: String(meta.property_quantity ?? '1'),
      property_unit: String(meta.property_unit ?? t('marketplace.investment.defaultUnit')),
      amount: Number(this.economyService.assetToUnits(String(prop.amount))) / 10_000,
    };
  }

  private async requireAgreement(coopname: string, username: string): Promise<{ number: string; signed_at: string }> {
    const agreement = await this.getAgreement(coopname, username);
    if (!agreement) throw DomainError.badRequest('MARKETPLACE_INVAGR_REQUIRED');
    return agreement;
  }

  private async requireProperty(coopname: string, hash: string): Promise<MarketContract.Tables.InvProps.IMktInvProp> {
    const prop = await this.chainPort.getInvestProperty(coopname, hash);
    if (!prop) throw DomainError.badRequest('MARKETPLACE_IPROP_NOT_FOUND');
    return prop;
  }

  /** Правило контракта заранее: вносить может председатель или доверенное лицо участка. */
  private async requireOperator(coopname: string, braname: string, username: string): Promise<void> {
    if (!(await this.kuChairmanService.isMemberOfBranch(coopname, braname, username))) {
      throw DomainError.badRequest('MARKETPLACE_INVEST_NOT_OPERATOR');
    }
  }

  private async branchName(braname: string): Promise<string> {
    return (await this.accountPort.getDisplayName(braname)) || braname;
  }

  private async chairmanName(coopname: string, braname: string): Promise<string> {
    const trustee = await this.kuChairmanService.getTrusteeOfBranch(coopname, braname);
    return trustee ? (await this.accountPort.getDisplayName(trustee)) || trustee : '';
  }

  private toAsset(amountHuman: number): string {
    if (!Number.isFinite(amountHuman) || amountHuman <= 0) throw DomainError.badRequest('MARKETPLACE_INVEST_AMOUNT_INVALID');
    return this.economyService.unitsToAsset(this.economyService.assetToUnits(amountHuman.toFixed(4)));
  }

  private dateOf(signedAt: string): string {
    const d = new Date(signedAt.endsWith('Z') ? signedAt : `${signedAt}Z`);
    return Number.isNaN(d.getTime()) ? signedAt : d.toLocaleDateString('ru-RU', { timeZone: 'UTC' });
  }

  private newHash(): string {
    return randomBytes(32).toString('hex');
  }

  private async submit(send: () => Promise<unknown>): Promise<void> {
    try {
      await send();
    } catch (e) {
      rethrowChainError(e);
    }
  }
}
