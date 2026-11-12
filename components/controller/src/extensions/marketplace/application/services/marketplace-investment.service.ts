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
  /** Внесено деньгами всего; перевод на главный паевой кошелёк его не уменьшает. */
  money_in: bigint;
  /** Возмещено полностью: строка в состоянии done, переводить нечего, неиспользованных денег нет. */
  settled: boolean;
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
  /** Σ внесённого деньгами всего по строкам инициаторов участка. */
  money_in_total: bigint;
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
  /** Поля бланка владельца 12.11.2026 (Приложение № 1 к договору); необязательны. */
  property_category?: string;
  property_media_links?: string;
  property_warranty_terms?: string;
  property_other?: string;
  /** Срок Гарантийных обязательств в днях. */
  property_warranty_days?: string;
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

  /**
   * Номер договора «УХД-…» — короткий отпечаток пары «пайщик — участок»:
   * договор заключается на каждый участок отдельно (решение владельца 12.11.2026).
   */
  agreementNumber(coopname: string, username: string, braname: string): string {
    const print = createHash('sha256').update(`${coopname}:${username}:${braname}:invest`).digest('hex').slice(0, 8).toUpperCase();
    return `УХД-${print}`; // i18n-ignore: префикс номера договора — часть идентификатора документа, не текст интерфейса
  }

  async getAgreement(coopname: string, username: string, braname: string): Promise<{ number: string; signed_at: string } | null> {
    const row = await this.chainPort.getInvestAgreement(coopname, username, braname);
    return row ? { number: this.agreementNumber(coopname, username, braname), signed_at: String(row.signed_at) } : null;
  }

  async generateAgreement(coopname: string, username: string, braname: string): Promise<InnerGeneratedDocument> {
    const data: Registry.MarketplaceInvestAgreement.Action = {
      registry_id: Registry.MarketplaceInvestAgreement.registry_id,
      coopname,
      username,
      lang: 'ru',
      agreement_number: this.agreementNumber(coopname, username, braname),
      braname,
      branch_name: await this.branchName(braname),
      skip_save: false,
    };
    return this.documentPort.generate({ data });
  }

  async signAgreement(coopname: string, username: string, braname: string, signed: SignedDigitalDocumentInputDTO): Promise<void> {
    await this.submit(() =>
      this.chainPort.signInvestAgreement({
        coopname,
        username,
        braname,
        agreement: new SignedDigitalDocumentInputDTO(signed).toDocument() as MarketContract.Actions.SignInvAgr.ISignInvAgr['agreement'],
      })
    );
  }

  // ── Паевой взнос деньгами ──────────────────────────────────────────────────

  async generateInvestStatement(coopname: string, username: string, braname: string, amount: number): Promise<InnerGeneratedDocument> {
    const agreement = await this.requireAgreement(coopname, username, braname);
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
    const agreement = await this.requireAgreement(coopname, username, braname);
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
      ...this.ownerFormFields(fields),
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

  /** Акт 1122 к первой подписи вносящего; вторую ставит председатель совета в одобрении. */
  async generatePropertyAct(coopname: string, propertyHash: string): Promise<InnerGeneratedDocument> {
    const prop = await this.requireProperty(coopname, propertyHash);
    const decisionId = await this.propertyDecisionId(coopname, prop);
    if (decisionId === null) throw DomainError.badRequest('MARKETPLACE_IPROP_DECISION_MISSING');
    const meta = this.statementMeta(prop);
    const agreement = await this.requireAgreement(coopname, prop.username, prop.braname);
    const data: Registry.MarketplaceInvestPropertyAct.Action = {
      registry_id: Registry.MarketplaceInvestPropertyAct.registry_id,
      coopname,
      username: prop.username,
      lang: 'ru',
      decision_id: decisionId,
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
      ...this.ownerFormFields(meta),
      skip_save: false,
    };
    const doc = await this.documentPort.generate({ data });
    // Акт подписан вносящим: председатель участка подписывает тот же документ —
    // хэш и мета берутся из акта в цепи (контракт сверяет хэш). Текст для
    // показа собран заново из тех же данных.
    return doc;
  }

  /**
   * Вносящий подписывает акт первой подписью. Вторую подпись ставит
   * председатель совета в «Запросах одобрения» (или кнопкой на странице
   * «Инициаторы участка»): контракт создаёт одобрение сам, совет по нему
   * вызывает marketplace::apprvipact (решение владельца 08.11.2026).
   */
  async signPropertyAct(coopname: string, signer: string, propertyHash: string, signed: SignedDigitalDocumentInputDTO): Promise<void> {
    await this.requireProperty(coopname, propertyHash);
    const act = new SignedDigitalDocumentInputDTO(signed).toDocument() as MarketContract.Actions.Act1IProp.IAct1IProp['act'];
    await this.submit(() => this.chainPort.signInvestPropertyAct1({ coopname, username: signer, property_hash: propertyHash, act }));
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
    const agreement = await this.requireAgreement(coopname, username, braname);
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
    const views = crps ? investors.map((r) => this.investorView(crps, r)) : [];
    return {
      braname,
      phase: this.phaseOf(branch, investors.length),
      money_total: units(branch?.money_total, this.economyService),
      money_in_total: views.reduce((sum, v) => sum + v.money_in, 0n),
      property_total: units(branch?.property_total, this.economyService),
      unused_total: units(branch?.unused_total, this.economyService),
      reserved: units(branch?.reserved, this.economyService),
      spent_total: units(branch?.spent_total, this.economyService),
      repaid_total: units(branch?.repaid_total, this.economyService),
      outstanding: crps ? crpsOutstanding(crps) : 0n,
      investors: views,
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
    const claimable = crpsClaimable(branch, inv).total;
    const unused = inv.money - inv.usedMoney;
    return {
      braname: row.braname,
      username: row.username,
      active: inv.active,
      money: inv.money,
      // Строка прежней сборки поля не несёт — внесённым считается текущий остаток.
      money_in: row.money_in ? units(row.money_in, this.economyService) : inv.money,
      settled: !inv.active && claimable === 0n && unused === 0n,
      property: inv.property,
      used,
      returned,
      claimed: inv.claimed,
      claimable,
      unused,
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
      property_category: this.metaText(meta.property_category),
      property_media_links: this.metaText(meta.property_media_links),
      property_warranty_terms: this.metaText(meta.property_warranty_terms),
      property_other: this.metaText(meta.property_other),
      property_warranty_days: this.metaText(meta.property_warranty_days),
    };
  }

  private metaText(value: unknown): string | undefined {
    return value === undefined || value === null ? undefined : String(value);
  }

  /**
   * Поля бланка владельца для заявления 1120 и акта 1122. Стоимость единицы —
   * показ в документе: цена приёма, делённая на количество, с округлением
   * вниз до копейки; цену приёма называет пайщик, контракт её не делит.
   */
  private ownerFormFields(fields: MarketplaceInvestPropertyFields) {
    const quantity = Number(String(fields.property_quantity).replace(',', '.'));
    const unitCost = Number.isFinite(quantity) && quantity > 0 ? Math.floor((fields.amount / quantity) * 100) / 100 : undefined;
    return {
      property_category: fields.property_category ?? '',
      property_media_links: fields.property_media_links ?? '',
      property_warranty_terms: fields.property_warranty_terms ?? '',
      property_other: fields.property_other ?? '',
      property_warranty_days: fields.property_warranty_days ?? '',
      property_unit_cost: unitCost === undefined ? '' : this.toAsset(unitCost),
    };
  }

  private async requireAgreement(coopname: string, username: string, braname: string): Promise<{ number: string; signed_at: string }> {
    const agreement = await this.getAgreement(coopname, username, braname);
    if (!agreement) throw DomainError.badRequest('MARKETPLACE_INVAGR_REQUIRED');
    return agreement;
  }

  /**
   * Номер решения совета о приёме имущества. Робот исполняет решение, и строка
   * в soviet::decisions стирается, поэтому после решения номер берётся из
   * протокола 1121, который контракт кладёт в заявление (поле `decision`).
   * Таблица совета — только пока решение ещё не исполнено.
   */
  private async propertyDecisionId(coopname: string, prop: MarketContract.Tables.InvProps.IMktInvProp): Promise<number | null> {
    const raw = prop.decision?.meta;
    if (raw) {
      const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { decision_id?: number | string };
      if (parsed.decision_id !== undefined && parsed.decision_id !== null && String(parsed.decision_id) !== '') return Number(parsed.decision_id);
    }
    const decision = await this.chainPort.findCouncilDecisionByHash(coopname, prop.hash);
    return decision ? Number(decision.id) : null;
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
