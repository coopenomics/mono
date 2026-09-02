import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { createHash, randomUUID } from 'crypto';
import { Cooperative } from 'cooptypes';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  DECISION_TRACKING_PORT,
  DOCUMENT_PORT,
  DecisionEventType,
  DecisionTrackedEvent,
  FREE_DECISION_PORT,
  LOGGER_PORT,
  USER_WALLET_PORT,
  type IDecisionTrackingPort,
  type IDocumentPort,
  type IFreeDecisionPort,
  type ILoggerPort,
  type InnerDocumentAggregate,
  type InnerGeneratedDocument,
  type ISignedDocument,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import { EduAssignmentStatus, EduContractStatus, EduContributionStatus } from '../../domain/enums';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeContributionEntity, EdubridgeTeacherAssignmentEntity, EdubridgeTeacherContractEntity } from '../../infrastructure/entities';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeTeacherRepository } from '../../infrastructure/repositories/edubridge-teacher.repository';
import type { EduAssignmentInputDTO, EduContributionDraftInputDTO, EduTeacherSettlementDTO } from '../dto/edu-teacher.dto';
import {
  EDUBRIDGE_ANNEX_DECIDED_EVENT,
  EDUBRIDGE_CONTRACT_DECIDED_EVENT,
  EDUBRIDGE_CONTRIBUTION_DECIDED_EVENT,
  EDUBRIDGE_CONTRIBUTION_SUBMITTED_EVENT,
} from '../events/edubridge.events';

const SHARE_WALLET = 'w.wal.share';
/** Одно поле vars под все решения о РИД — ядро пишет туда номер и дату последнего решения. */
const RID_VARS_FIELD = 'education_rid_decision';

/**
 * Преподавательский контур: ДУХД → назначение с приложением → взнос РИД по
 * заявлению → решение совета (платформенный проект свободного решения) →
 * акт приёма-передачи → `acceptrid` (проводка Дт 04 / Кт 80, право требования
 * в главном паевом кошельке; возврат — штатным механизмом платформы).
 *
 * Договор УХД и приложения к нему — двухподписные, как в «Благоросте»:
 * преподаватель подписывает первым (`signcontract` / `signannex`), контракт
 * ставит документ в очередь одобрений совета, председатель подписывает вторым
 * со стола «Запросы одобрений», и коллбэк совета (`apprvcontr` / `apprvannex`)
 * делает договор действующим или назначение активным — статусы здесь
 * переводит слушатель этих действий, а не сама мутация.
 */
@Injectable()
export class EdubridgeTeacherService {
  constructor(
    private readonly teachers: EdubridgeTeacherRepository,
    private readonly courses: EdubridgeCourseRepository,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    @Inject(FREE_DECISION_PORT) private readonly freeDecisions: IFreeDecisionPort,
    @Inject(DECISION_TRACKING_PORT) private readonly tracking: IDecisionTrackingPort,
    @Inject(USER_WALLET_PORT) private readonly wallets: IUserWalletPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly events: EventEmitter2
  ) {
    this.logger.setContext(EdubridgeTeacherService.name);
  }

  // ── Договор УХД ────────────────────────────────────────────────────────────
  contract(coopname: string, teacher: string) {
    return this.teachers.findContract(coopname, teacher);
  }

  /**
   * Первая подпись договора — преподавателя. В цепь уходит `signcontract`,
   * запись ждёт подписи председателя; действующим договор станет по
   * коллбэку совета (`onContractApproved`). Отклонённый договор подписывается
   * заново — старая запись перезаписывается.
   */
  async signContract(coopname: string, teacher: string, document: ISignedDocument, number: string) {
    const existing = await this.teachers.findContract(coopname, teacher);
    if (existing && existing.status !== EduContractStatus.DECLINED) return existing;
    if (!document.signatures?.some((s) => s.signer === teacher)) throw new BadRequestException('Договор не подписан преподавателем');

    await this.chain.signContract({ coopname, username: teacher, contract_hash: document.hash, contract: document as never });
    this.logger.info(`[EDU.TEACH] ${teacher}: договор УХД ${document.hash} подписан, ждёт подписи председателя`);

    return this.teachers.saveContract({
      ...(existing ?? {}),
      coopname,
      teacher_username: teacher,
      contract_hash: document.hash.toLowerCase(),
      contract_number: number,
      status: EduContractStatus.PENDING_APPROVAL,
      decline_reason: '',
      approved_at: null,
    });
  }

  /** Коллбэк совета `apprvcontr`: председатель подписал — договор действует. */
  async onContractApproved(coopname: string, teacher: string, contractHash: string): Promise<void> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c || c.contract_hash !== contractHash.toLowerCase()) {
      this.logger.warn(`[EDU.TEACH] apprvcontr для неизвестного договора ${contractHash} (${teacher})`);
      return;
    }
    c.status = EduContractStatus.ACTIVE;
    c.approved_at = new Date();
    c.decline_reason = '';
    await this.teachers.saveContract(c);
    this.events.emit(EDUBRIDGE_CONTRACT_DECIDED_EVENT, { coopname, teacher_username: teacher, contract_hash: c.contract_hash, approved: true });
  }

  /** Коллбэк совета `dclinecontr`: председатель отказал — договор можно подписать заново. */
  async onContractDeclined(coopname: string, teacher: string, contractHash: string, reason: string): Promise<void> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c || c.contract_hash !== contractHash.toLowerCase()) return;
    c.status = EduContractStatus.DECLINED;
    c.decline_reason = reason;
    await this.teachers.saveContract(c);
    this.events.emit(EDUBRIDGE_CONTRACT_DECIDED_EVENT, { coopname, teacher_username: teacher, contract_hash: c.contract_hash, approved: false, reason });
  }

  private async requireContract(coopname: string, teacher: string): Promise<EdubridgeTeacherContractEntity> {
    const c = await this.teachers.findContract(coopname, teacher);
    if (!c) throw new BadRequestException('Сначала подпишите договор участия в хозяйственной деятельности');
    if (c.status === EduContractStatus.PENDING_APPROVAL) throw new BadRequestException('Договор ещё не подписан председателем совета');
    if (c.status !== EduContractStatus.ACTIVE) throw new BadRequestException('Договор отклонён председателем — подпишите его заново');
    return c;
  }

  // ── Назначения ─────────────────────────────────────────────────────────────
  async listAssignments(coopname: string, teacher?: string) {
    const rows = await this.teachers.listAssignments(coopname, teacher ? { teacher } : {});
    return Promise.all(rows.map(async (a) => ({ assignment: a, course: await this.courses.findById(coopname, a.course_id) })));
  }

  async createAssignment(coopname: string, input: EduAssignmentInputDTO): Promise<EdubridgeTeacherAssignmentEntity> {
    const course = await this.courses.findById(coopname, input.course_id);
    if (!course) throw new NotFoundException('Курс не найден');
    if (input.period_to < input.period_from) throw new BadRequestException('Конец периода раньше начала');
    const entity = this.teachers.createAssignment({
      coopname,
      teacher_username: input.teacher_username.trim(),
      course_id: input.course_id,
      schedule: input.schedule ?? '',
      expected_result: input.expected_result ?? '',
      period_from: input.period_from,
      period_to: input.period_to,
      status: EduAssignmentStatus.DRAFT,
    });
    return this.teachers.saveAssignment(entity);
  }

  async closeAssignment(coopname: string, id: string): Promise<EdubridgeTeacherAssignmentEntity> {
    const a = await this.teachers.findAssignment(coopname, id);
    if (!a) throw new NotFoundException('Назначение не найдено');
    a.status = EduAssignmentStatus.CLOSED;
    return this.teachers.saveAssignment(a);
  }

  /**
   * Первая подпись приложения — преподавателя. В цепь уходит `signannex`,
   * назначение ждёт подписи председателя; активным станет по коллбэку совета
   * (`onAnnexApproved`). Отклонённое приложение подписывается заново.
   */
  async signAnnex(coopname: string, teacher: string, assignmentId: string, document: ISignedDocument): Promise<EdubridgeTeacherAssignmentEntity> {
    await this.requireContract(coopname, teacher);
    const a = await this.teachers.findAssignment(coopname, assignmentId);
    if (!a) throw new NotFoundException('Назначение не найдено');
    if (a.teacher_username !== teacher) throw new ForbiddenException('Назначение выдано другому преподавателю');
    if (a.status !== EduAssignmentStatus.DRAFT && a.status !== EduAssignmentStatus.DECLINED) {
      throw new BadRequestException('Приложение по этому назначению уже подписано');
    }
    if (!document.signatures?.some((s) => s.signer === teacher)) throw new BadRequestException('Приложение не подписано преподавателем');
    const course = await this.courses.findById(coopname, a.course_id);
    if (!course) throw new NotFoundException('Курс назначения не найден');

    await this.chain.signAnnex({
      coopname,
      username: teacher,
      course_id: Number(course.chain_ref),
      annex_hash: document.hash,
      annex: document as never,
    });
    this.logger.info(`[EDU.TEACH] ${teacher}: приложение ${document.hash} по курсу «${course.title}» подписано, ждёт подписи председателя`);

    a.annex_hash = document.hash.toLowerCase();
    a.status = EduAssignmentStatus.PENDING_APPROVAL;
    a.decline_reason = '';
    return this.teachers.saveAssignment(a);
  }

  /** Коллбэк совета `apprvannex`: председатель подписал приложение — назначение действует. */
  async onAnnexApproved(coopname: string, teacher: string, annexHash: string): Promise<void> {
    const a = await this.teachers.findAssignmentByAnnexHash(coopname, annexHash);
    if (!a || a.teacher_username !== teacher) {
      this.logger.warn(`[EDU.TEACH] apprvannex для неизвестного приложения ${annexHash} (${teacher})`);
      return;
    }
    a.status = EduAssignmentStatus.ACTIVE;
    a.decline_reason = '';
    await this.teachers.saveAssignment(a);
    this.events.emit(EDUBRIDGE_ANNEX_DECIDED_EVENT, { coopname, teacher_username: teacher, assignment_id: a.id, approved: true });
  }

  /** Коллбэк совета `dclineannex`: председатель отказал — назначение отклонено. */
  async onAnnexDeclined(coopname: string, teacher: string, annexHash: string, reason: string): Promise<void> {
    const a = await this.teachers.findAssignmentByAnnexHash(coopname, annexHash);
    if (!a || a.teacher_username !== teacher) return;
    a.status = EduAssignmentStatus.DECLINED;
    a.decline_reason = reason;
    await this.teachers.saveAssignment(a);
    this.events.emit(EDUBRIDGE_ANNEX_DECIDED_EVENT, { coopname, teacher_username: teacher, assignment_id: a.id, approved: false, reason });
  }

  // ── Взносы РИД ─────────────────────────────────────────────────────────────
  listContributions(coopname: string, teacher?: string, statuses?: EduContributionStatus[]) {
    return this.teachers.listContributions(coopname, { teacher, statuses });
  }

  async draftContribution(coopname: string, teacher: string, input: EduContributionDraftInputDTO): Promise<EdubridgeContributionEntity> {
    await this.requireContract(coopname, teacher);
    const a = await this.teachers.findAssignment(coopname, input.assignment_id);
    if (!a || a.teacher_username !== teacher) throw new NotFoundException('Назначение не найдено');
    if (a.status !== EduAssignmentStatus.ACTIVE) throw new BadRequestException('Назначение не активно — подпишите приложение к договору');
    const ridHash = createHash('sha256').update(`${coopname}|${teacher}|${a.id}|${randomUUID()}`).digest('hex');
    const entity = this.teachers.createContribution({
      coopname,
      teacher_username: teacher,
      assignment_id: a.id,
      rid_hash: ridHash,
      rid_type: input.rid_type,
      links: input.links.map((l) => l.trim()).filter(Boolean),
      description: input.description ?? '',
      amount: input.amount,
      status: EduContributionStatus.DRAFT,
    });
    return this.teachers.saveContribution(entity);
  }

  /** Заявление (3008) без подписи — для ознакомления и подписи на фронте. */
  async statement(coopname: string, teacher: string, contributionId: string): Promise<InnerGeneratedDocument> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    const action: Cooperative.Registry.EducationRidStatement.Action = {
      registry_id: Cooperative.Registry.EducationRidStatement.registry_id,
      coopname,
      username: teacher,
      lang: 'ru',
      rid_hash: c.rid_hash,
      assignment_id: Number((await this.teachers.findAssignment(coopname, c.assignment_id))?.created_at.getTime() ?? 0) % 1_000_000,
      amount: c.amount,
      rid_type: c.rid_type,
      links: c.links,
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  /** Подача: `submitrid` в цепь + проект решения совета с отслеживанием. */
  async submitContribution(coopname: string, teacher: string, contributionId: string, document: ISignedDocument): Promise<EdubridgeContributionEntity> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    if (c.status !== EduContributionStatus.DRAFT) throw new BadRequestException('Взнос уже подан');

    await this.chain.submitRid({
      coopname,
      username: teacher,
      rid_hash: c.rid_hash,
      assignment_id: Number(new Date(c.created_at).getTime() % 1_000_000),
      amount: c.amount,
      rid_type: c.rid_type,
      statement: document,
    } as never);
    c.statement_hash = document.hash.toLowerCase();
    c.status = EduContributionStatus.SUBMITTED;

    // Решение совета — платформенный проект свободного решения; по принятию ядро
    // эмитит DecisionTrackedEvent с нашими метаданными.
    const projectId = randomUUID();
    const title = `Приём паевого взноса РИД преподавателя ${teacher} на ${c.amount}`;
    await this.freeDecisions.createProjectOfFreeDecision({
      id: projectId,
      title,
      question: `О приёме паевого взноса результатом интеллектуальной деятельности от ${teacher}`,
      decision: `Принять паевой взнос результатом интеллектуальной деятельности (${c.rid_type}) от ${teacher} на сумму ${c.amount} по заявлению ${c.statement_hash}.`,
    });
    const project = await this.freeDecisions.generateProjectOfFreeDecisionDocument(
      { project_id: projectId, coopname, username: await this.chairman(coopname), registry_id: Cooperative.Registry.ProjectFreeDecision.registry_id, title },
      {}
    );
    const meta = project.meta as Record<string, any>;
    await this.freeDecisions.publishProjectOfFreeDecision({
      coopname,
      username: await this.chairman(coopname),
      meta: JSON.stringify({ extension: 'edubridge', rid_hash: c.rid_hash, project_id: projectId, title }),
      document: { version: meta?.version || '1.0', hash: project.hash, doc_hash: meta?.doc_hash || project.hash, meta_hash: meta?.meta_hash || project.hash, meta: project.meta, signatures: meta?.signatures || [] },
    });
    await this.tracking.registerTrackingRule({
      hash: project.hash,
      event_type: DecisionEventType.SOVIET_DECISION,
      vars_field: RID_VARS_FIELD,
      metadata: { extension: 'edubridge', rid_hash: c.rid_hash, project_id: projectId },
    });
    c.council_project_hash = project.hash.toLowerCase();
    const saved = await this.teachers.saveContribution(c);
    this.events.emit(EDUBRIDGE_CONTRIBUTION_SUBMITTED_EVENT, { coopname, contribution_id: saved.id, teacher_username: teacher });
    this.logger.info(`[EDU.RID] взнос ${c.rid_hash} подан, проект решения ${project.hash}`);
    return saved;
  }

  /** Совет принял решение: ждём акт преподавателя. */
  @OnEvent(DecisionTrackedEvent.eventName)
  async onDecisionTracked(event: DecisionTrackedEvent): Promise<void> {
    const r = event.result;
    if (!r.matched || r.metadata?.extension !== 'edubridge' || !r.metadata?.rid_hash) return;
    const c = await this.teachers.findContributionByRidHash(String(r.metadata.rid_hash));
    if (!c || c.status !== EduContributionStatus.SUBMITTED) return;
    c.status = EduContributionStatus.COUNCIL_APPROVED;
    c.council_decision_id = r.decision_id ? String(r.decision_id) : null;
    c.decided_at = r.decision_date ? new Date(r.decision_date) : new Date();
    await this.teachers.saveContribution(c);
    this.logger.info(`[EDU.RID] совет принял решение ${r.decision_id} по взносу ${c.rid_hash} — ждём акт преподавателя`);
  }

  /** Акт приёма-передачи (3010) без подписи — после решения совета. */
  async act(coopname: string, teacher: string, contributionId: string): Promise<InnerGeneratedDocument> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    if (c.status !== EduContributionStatus.COUNCIL_APPROVED) throw new BadRequestException('Акт доступен после решения совета');
    const action: Cooperative.Registry.EducationRidAct.Action = {
      registry_id: Cooperative.Registry.EducationRidAct.registry_id,
      coopname,
      username: teacher,
      lang: 'ru',
      rid_hash: c.rid_hash,
      amount: c.amount,
      rid_type: c.rid_type,
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  /** Преподаватель подписал акт: сохраняем документ и ждём подпись председателя на нём же. */
  async signAct(coopname: string, teacher: string, contributionId: string, act: ISignedDocument): Promise<EdubridgeContributionEntity> {
    const c = await this.ownContribution(coopname, teacher, contributionId);
    if (c.status !== EduContributionStatus.COUNCIL_APPROVED) throw new BadRequestException('Акт доступен после решения совета');
    if (!act.signatures?.some((s) => s.signer === teacher)) throw new BadRequestException('Акт не подписан преподавателем');
    c.act_hash = act.hash.toLowerCase();
    c.act_signed = act as unknown as Record<string, unknown>;
    c.status = EduContributionStatus.ACT_SIGNED;
    const saved = await this.teachers.saveContribution(c);
    this.logger.info(`[EDU.RID] акт ${c.act_hash} подписан преподавателем — ждём подпись председателя`);
    return saved;
  }

  /** Агрегат акта для второй подписи: тот же документ, без перегенерации. */
  async actSignablePayload(coopname: string, contributionId: string): Promise<InnerDocumentAggregate> {
    const c = await this.teachers.findContribution(coopname, contributionId);
    if (!c) throw new NotFoundException('Взнос не найден');
    if (c.status !== EduContributionStatus.ACT_SIGNED || !c.act_signed) throw new BadRequestException('Акт ещё не подписан преподавателем');
    const aggregate = await this.documents.buildAggregate(c.act_signed as unknown as ISignedDocument);
    if (!aggregate) throw new NotFoundException('Акт не найден в реестре документов');
    return aggregate;
  }

  /**
   * Председатель подписал тот же акт (вторая подпись по хэшу) → протокол (3009)
   * + акт с двумя подписями → `acceptrid`: проводка Дт 04 / Кт 80, право требования.
   */
  async acceptContribution(coopname: string, chairman: string, contributionId: string, act: ISignedDocument): Promise<EdubridgeContributionEntity> {
    const c = await this.teachers.findContribution(coopname, contributionId);
    if (!c) throw new NotFoundException('Взнос не найден');
    if (c.status !== EduContributionStatus.ACT_SIGNED) throw new BadRequestException('Акт ещё не подписан преподавателем');
    if (act.hash.toLowerCase() !== c.act_hash) throw new BadRequestException('Подписан другой документ: хэш акта не совпадает');
    const signers = new Set((act.signatures ?? []).map((s) => s.signer));
    if (!signers.has(c.teacher_username) || !signers.has(chairman)) {
      throw new BadRequestException('На акте должны быть подписи преподавателя и председателя');
    }
    const decision = await this.documents.generate({
      data: {
        registry_id: Cooperative.Registry.EducationRidDecision.registry_id,
        coopname,
        username: await this.chairman(coopname),
        lang: 'ru',
        rid_hash: c.rid_hash,
        amount: c.amount,
        decision_id: Number(c.council_decision_id ?? 0),
        skip_save: false,
      } as Cooperative.Registry.EducationRidDecision.Action,
    });
    await this.chain.acceptRid({ coopname, rid_hash: c.rid_hash, decision: this.unsigned(decision), act } as never);
    c.decision_hash = decision.hash.toLowerCase();
    c.act_signed = act as unknown as Record<string, unknown>;
    c.status = EduContributionStatus.ACCEPTED;
    const saved = await this.teachers.saveContribution(c);
    this.events.emit(EDUBRIDGE_CONTRIBUTION_DECIDED_EVENT, { coopname, contribution_id: saved.id, teacher_username: c.teacher_username, accepted: true });
    this.logger.info(`[EDU.RID] взнос ${c.rid_hash} принят — acceptrid, право требования в кошельке ${c.teacher_username}`);
    return saved;
  }

  async decline(coopname: string, contributionId: string, reason: string): Promise<EdubridgeContributionEntity> {
    const c = await this.teachers.findContribution(coopname, contributionId);
    if (!c) throw new NotFoundException('Взнос не найден');
    if (![EduContributionStatus.SUBMITTED, EduContributionStatus.COUNCIL_APPROVED, EduContributionStatus.ACT_SIGNED].includes(c.status)) {
      throw new BadRequestException('Отклонить можно только поданный взнос');
    }
    const decision = await this.documents.generate({
      data: {
        registry_id: Cooperative.Registry.EducationRidDecision.registry_id,
        coopname,
        username: await this.chairman(coopname),
        lang: 'ru',
        rid_hash: c.rid_hash,
        amount: c.amount,
        decision_id: Number(c.council_decision_id ?? 0),
        skip_save: false,
      } as Cooperative.Registry.EducationRidDecision.Action,
    });
    await this.chain.declineRid({ coopname, rid_hash: c.rid_hash, decision: this.unsigned(decision) } as never);
    c.decision_hash = decision.hash.toLowerCase();
    c.decline_reason = reason;
    c.status = EduContributionStatus.DECLINED;
    c.decided_at = new Date();
    const saved = await this.teachers.saveContribution(c);
    this.events.emit(EDUBRIDGE_CONTRIBUTION_DECIDED_EVENT, { coopname, contribution_id: saved.id, teacher_username: c.teacher_username, accepted: false });
    return saved;
  }

  // ── Расчёт ─────────────────────────────────────────────────────────────────
  async settlement(coopname: string, teacher: string): Promise<EduTeacherSettlementDTO> {
    const accepted = await this.teachers.listContributions(coopname, { teacher, statuses: [EduContributionStatus.ACCEPTED] });
    const symbol = accepted[0]?.amount.split(' ')[1] ?? platformSettings().blockchain.rootGovernSymbol;
    const total = accepted.reduce((s, c) => s + parseFloat(c.amount), 0);
    const wallet = await this.wallets.findByWalletAndUsername(coopname, SHARE_WALLET, teacher);
    const available = Number.parseFloat(wallet?.available ?? '0');
    return {
      accepted_total: `${total.toFixed(4)} ${symbol}`,
      available: `${(Number.isNaN(available) ? 0 : available).toFixed(4)} ${symbol}`,
      last_accepted_at: accepted.map((c) => c.decided_at).filter(Boolean).sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] ?? null,
    };
  }

  private async ownContribution(coopname: string, teacher: string, id: string): Promise<EdubridgeContributionEntity> {
    const c = await this.teachers.findContribution(coopname, id);
    if (!c) throw new NotFoundException('Взнос не найден');
    if (c.teacher_username !== teacher) throw new ForbiddenException('Взнос принадлежит другому преподавателю');
    return c;
  }

  private unsigned(doc: InnerGeneratedDocument): ISignedDocument {
    const meta = doc.meta as Record<string, any>;
    return { version: meta?.version || '1.0', hash: doc.hash, doc_hash: meta?.doc_hash || doc.hash, meta_hash: meta?.meta_hash || doc.hash, meta: doc.meta as ISignedDocument['meta'], signatures: [] };
  }

  private async chairman(_coopname: string): Promise<string> {
    return platformSettings().coopname; // документы совета формируются от имени кооператива
  }
}
