import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHash, randomUUID } from 'crypto';
import { Cooperative } from 'cooptypes';
import { chainErrorCode, DomainError, platformSettings } from '@coopenomics/extension-kit';
import {
  COUNCIL_PORT,
  DECISION_TRACKING_PORT,
  DOCUMENT_PORT,
  DecisionEventType,
  DecisionTrackedEvent,
  FREE_DECISION_PORT,
  LOGGER_PORT,
  type ICouncilPort,
  type IDecisionTrackingPort,
  type IDocumentPort,
  type IFreeDecisionPort,
  type ILoggerPort,
  type InnerGeneratedDocument,
  type ISignedDocument,
} from '@coopenomics/innercoop';
import { EduCouncilOutcome } from '../../domain/enums';
import { EduGuaranteeClaimStatus } from '../../domain/enums/guarantee-claim-status.enum';
import { entryGuaranteeEndsAt, isEntryGuaranteeRunning } from '../../domain/economy/guarantee';
import { formatDate } from '../../domain/lib/lesson-dates';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeCourseRecord, EdubridgeEnrollmentRecord } from '../../infrastructure/entities';
import type { EdubridgeGuaranteeClaimRecord } from '../../infrastructure/entities/edubridge-guarantee-claim.record';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeGuaranteeClaimKyselyRepository } from '../../infrastructure/repositories/edubridge-guarantee-claim.kysely-repository';
import { EdubridgeGroupService } from './edubridge-group.service';
import { EdubridgeEnrollmentService, isCancellable } from './edubridge-enrollment.service';
import { t } from '../../i18n';

/** Поле реквизитов, куда ядро записывает решение совета по заявлению. */
const GUARANTEE_VARS_FIELD = 'education_guarantee_decision';
/** Ответ цепи на повторную публикацию того же заявления. */
const ALREADY_PUBLISHED = /уже (опубликован|существует|подан)/i;
const MAX_REASON = 2000;
const MAX_LINKS = 10;

/** Что участник видит по подписке: можно ли подать заявление и чем кончилось поданное. */
export interface GuaranteeState {
  enrollment_id: string;
  /** Заявление можно подать: гарантийный срок идёт, подписка действует, заявления ещё не было. */
  available: boolean;
  /** До какого дня действуют гарантийные условия; `null` — курс ещё не начался либо гарантии нет. */
  guarantee_until: Date | null;
  /** Стоимость подписки, которую совет вернёт при удовлетворении. */
  amount: string;
  claim: EdubridgeGuaranteeClaimRecord | null;
}

/**
 * Аннулирование подписки по гарантийным условиям (п. 4.4.2–4.4.4 Положения о
 * ЦПП «Образование»). Участник подаёт обоснованное заявление, пока идёт его
 * гарантийный срок; заявление рассматривает совет. Удовлетворил — подписка
 * закрывается, вся списанная стоимость возвращается на паевой, в реестр уходит
 * протокол. Отклонил либо не решил в срок — у участника остаётся обычный отказ
 * от подписки. Пока заявление у совета, подписка и доступ действуют.
 */
@Injectable()
export class EdubridgeGuaranteeService {
  constructor(
    private readonly claims: EdubridgeGuaranteeClaimKyselyRepository,
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly enrollmentService: EdubridgeEnrollmentService,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    @Inject(FREE_DECISION_PORT) private readonly freeDecisions: IFreeDecisionPort,
    @Inject(DECISION_TRACKING_PORT) private readonly tracking: IDecisionTrackingPort,
    @Inject(COUNCIL_PORT) private readonly council: ICouncilPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly groups: EdubridgeGroupService
  ) {
    this.logger.setContext(EdubridgeGuaranteeService.name);
  }

  /** Состояние гарантии по подпискам участника — для карточки курса и списка подписок. */
  async statesOf(coopname: string, member: string): Promise<GuaranteeState[]> {
    const own = await this.enrollments.findByMember(coopname, member);
    const claims = await this.claims.findByEnrollments(coopname, own.map((e) => e.id));
    const byEnrollment = new Map(claims.map((c) => [c.enrollment_id, c]));
    const states: GuaranteeState[] = [];
    for (const enrollment of own) {
      const course = await this.groups.courseOf(coopname, enrollment.course_id, enrollment.group_id);
      if (course) states.push(this.stateOf(enrollment, course, byEnrollment.get(enrollment.id) ?? null));
    }
    return states;
  }

  /** Заявление (3013) без подписи — участник читает его перед подписью. */
  async statement(coopname: string, member: string, enrollmentId: string, reason: string, links: string[]): Promise<InnerGeneratedDocument> {
    const { enrollment, course } = await this.claimable(coopname, member, enrollmentId);
    const end = entryGuaranteeEndsAt(course, enrollment);
    const action: Cooperative.Registry.EducationGuaranteeStatement.Action = {
      registry_id: Cooperative.Registry.EducationGuaranteeStatement.registry_id,
      coopname,
      username: member,
      lang: 'ru',
      claim_hash: claimHashOf(enrollment),
      course_title: course.title,
      subscribed_at: formatDate(enrollment.created_at),
      amount: enrollment.paid_amount,
      // До начала занятий срок ещё не отсчитывается: в заявление идёт дата начала курса плюс дни гарантии не известна.
      guarantee_until: end ? formatDate(end) : t('edubridge.guarantee.untilCourseStart'),
      reason: cleanReason(reason),
      links: cleanLinks(links),
    };
    return this.documents.generate({ data: action });
  }

  /**
   * Подача: заявление публикуется в цепи и тут же выносится на совет. Шаги
   * повторяемы — сбой на проекте решения оставляет заявление поданным, вопрос
   * совету довыносит очередь.
   */
  async submit(
    coopname: string,
    member: string,
    enrollmentId: string,
    reason: string,
    links: string[],
    document: ISignedDocument
  ): Promise<EdubridgeGuaranteeClaimRecord> {
    const { enrollment, course } = await this.claimable(coopname, member, enrollmentId);
    if (!document.signatures?.some((s) => s.signer === member)) throw DomainError.badRequest('EDUBRIDGE_GUARANTEE_NOT_SIGNED');

    try {
      await this.chain.claimGuarantee({ coopname, username: member, sub_hash: enrollment.sub_hash, statement: document as never });
    } catch (e) {
      if (!ALREADY_PUBLISHED.test((e as Error)?.message ?? '')) throw e;
      this.logger.warn(`[EDU.GUARANTEE] заявление по подписке ${enrollment.sub_hash} уже в цепи — продолжаем с проекта решения`);
    }
    const saved = await this.claims.save(
      this.claims.create({
        coopname,
        member_username: member,
        enrollment_id: enrollment.id,
        course_id: course.id,
        claim_hash: claimHashOf(enrollment),
        reason: cleanReason(reason),
        links: cleanLinks(links),
        amount: enrollment.paid_amount,
        status: EduGuaranteeClaimStatus.SUBMITTED,
        statement_document: document as unknown as Record<string, unknown>,
      })
    );
    this.logger.info(`[EDU.GUARANTEE] ${member}: заявление ${saved.claim_hash} по курсу «${course.title}» подано`);
    try {
      return await this.publish(coopname, saved, course);
    } catch (e) {
      this.logger.error(`[EDU.GUARANTEE] вопрос по заявлению ${saved.claim_hash} совету не вынесен: ${(e as Error)?.message ?? e}`);
      return saved;
    }
  }

  /** Заявления, поданные в цепь, но не дошедшие до совета из-за сбоя, — их довыносит очередь. */
  async publishPending(coopname: string): Promise<number> {
    let published = 0;
    for (const claim of await this.claims.findSubmittedWithoutProject(coopname)) {
      try {
        const course = await this.courses.findById(coopname, claim.course_id);
        if (!course) continue;
        await this.publish(coopname, claim, course);
        published += 1;
      } catch (e) {
        this.logger.error(`[EDU.GUARANTEE] вопрос по заявлению ${claim.claim_hash} совету не вынесен: ${(e as Error)?.message ?? e}`);
      }
    }
    return published;
  }

  /** Совет удовлетворил заявление: подписка аннулируется, стоимость возвращается, протокол уходит в реестр. */
  @OnEvent(DecisionTrackedEvent.eventName)
  async onDecisionTracked(event: DecisionTrackedEvent): Promise<void> {
    const r = event.result;
    if (!r.matched || r.metadata?.extension !== 'edubridge' || !r.metadata?.guarantee_claim_id) return;
    const coopname = platformSettings().coopname;
    const claim = await this.claims.findById(coopname, String(r.metadata.guarantee_claim_id));
    if (!claim || claim.status !== EduGuaranteeClaimStatus.SUBMITTED) return;
    claim.council_decision_id = r.decision_id ? String(r.decision_id) : null;
    claim.decided_at = r.decision_date ? new Date(r.decision_date) : new Date();
    await this.grant(coopname, claim);
  }

  /** Совет отклонил вопрос либо не уложился в срок: заявление закрывается, подписка остаётся как была. */
  async onCouncilGaveUp(coopname: string, agendaId: string, outcome: EduCouncilOutcome): Promise<void> {
    const claim = await this.claims.findByAgendaId(coopname, agendaId);
    if (!claim || claim.status !== EduGuaranteeClaimStatus.SUBMITTED) return;
    claim.status = outcome === EduCouncilOutcome.DECLINED ? EduGuaranteeClaimStatus.DECLINED : EduGuaranteeClaimStatus.EXPIRED;
    claim.decided_at = new Date();
    await this.claims.save(claim);
    await this.unfreeze(coopname, claim);
    this.logger.info(`[EDU.GUARANTEE] заявление ${claim.claim_hash}: совет решения не принял (${outcome})`);
  }

  /**
   * Заморозка взноса снимается: подписка продолжает действовать. Гарантийный
   * срок группы уже вышел — оплату занятий периода контракт оставляет программе.
   * Подписка могла закрыться, пока совет решал, — тогда снимать нечего.
   */
  private async unfreeze(coopname: string, claim: EdubridgeGuaranteeClaimRecord): Promise<void> {
    const enrollment = await this.enrollments.findById(coopname, claim.enrollment_id);
    if (!enrollment || !isCancellable(enrollment)) return;
    try {
      await this.chain.declineGuarantee({ coopname, username: claim.member_username, sub_hash: enrollment.sub_hash });
    } catch (e) {
      if (chainErrorCode(e) !== 'EDUBRIDGE_GUARANTEE_CLAIM_NOT_FOUND') {
        this.logger.error(`[EDU.GUARANTEE] заморозка по заявлению ${claim.claim_hash} не снята: ${(e as Error)?.message ?? e}`);
      }
    }
  }

  /** Идёт ли по подписке рассмотрение заявления: обычный отказ в это время закрыт, чтобы не было двух возвратов. */
  async isUnderReview(coopname: string, enrollmentId: string): Promise<boolean> {
    const claim = await this.claims.findByEnrollment(coopname, enrollmentId);
    return claim?.status === EduGuaranteeClaimStatus.SUBMITTED;
  }

  private async grant(coopname: string, claim: EdubridgeGuaranteeClaimRecord): Promise<void> {
    const enrollment = await this.enrollments.findById(coopname, claim.enrollment_id);
    const course = await this.courses.findById(coopname, claim.course_id);
    if (!enrollment || !course) return;
    const decision = await this.documents.generate({
      data: {
        registry_id: Cooperative.Registry.EducationGuaranteeDecision.registry_id,
        coopname,
        username: claim.member_username,
        lang: 'ru',
        decision_id: Number(claim.council_decision_id ?? 0),
        claim_hash: claim.claim_hash,
        course_title: course.title,
        amount: claim.amount,
        skip_save: false,
      } as Cooperative.Registry.EducationGuaranteeDecision.Action,
    });
    // Подписка могла закрыться, пока совет решал (истёк срок, выход из кооператива):
    // возвращать по ней уже нечего, решение совета остаётся в заявлении.
    if (isCancellable(enrollment)) {
      await this.enrollmentService.cancelByGuarantee(coopname, enrollment, { claim_hash: claim.claim_hash, decision: unsigned(decision) });
    }
    claim.decision_hash = decision.hash.toLowerCase();
    claim.status = EduGuaranteeClaimStatus.APPROVED;
    await this.claims.save(claim);
    this.logger.info(`[EDU.GUARANTEE] заявление ${claim.claim_hash} удовлетворено: подписка аннулирована, ${claim.amount} возвращено на паевой`);
  }

  /** Вопрос совету — проект свободного решения; по принятию ядро сообщает событием с нашими метаданными. */
  private async publish(coopname: string, claim: EdubridgeGuaranteeClaimRecord, course: EdubridgeCourseRecord): Promise<EdubridgeGuaranteeClaimRecord> {
    if (claim.council_project_hash) return claim;
    const projectId = randomUUID();
    const number = claim.claim_hash.slice(0, 8).toUpperCase();
    const title = t('edubridge.guarantee.decision.title', { member: claim.member_username, course: course.title });
    await this.freeDecisions.createProjectOfFreeDecision({
      id: projectId,
      title,
      question: t('edubridge.guarantee.decision.question', { member: claim.member_username, number, course: course.title }),
      decision: t('edubridge.guarantee.decision.decision', { member: claim.member_username, number, course: course.title, amount: claim.amount, reason: claim.reason }),
    });
    const author = platformSettings().coopname; // документы совета формируются от имени кооператива
    const project = await this.freeDecisions.generateProjectOfFreeDecisionDocument(
      { project_id: projectId, coopname, username: author, registry_id: Cooperative.Registry.ProjectFreeDecision.registry_id, title },
      {}
    );
    await this.freeDecisions.publishProjectOfFreeDecision({
      coopname,
      username: author,
      meta: JSON.stringify({ extension: 'edubridge', guarantee_claim_id: claim.id, project_id: projectId, title }),
      document: projectDocument(project),
    });
    await this.tracking.registerTrackingRule({
      hash: project.hash,
      event_type: DecisionEventType.SOVIET_DECISION,
      vars_field: GUARANTEE_VARS_FIELD,
      metadata: { extension: 'edubridge', guarantee_claim_id: claim.id, project_id: projectId },
    });
    claim.council_project_hash = project.hash.toLowerCase();
    claim.council_agenda_id = await this.lookupAgendaId(coopname, project.hash);
    return this.claims.save(claim);
  }

  /** Номер вопроса в повестке совета по хэшу проекта решения: по нему придёт отклонение либо снятие по сроку. */
  private async lookupAgendaId(coopname: string, projectHash: string): Promise<string | null> {
    try {
      const decisions = await this.council.getDecisions(coopname);
      const found = decisions.find((d) => String(d.hash ?? '').toLowerCase() === projectHash.toLowerCase());
      if (found) return String(found.id);
    } catch (e) {
      this.logger.warn(`[EDU.GUARANTEE] повестка совета не прочитана: ${(e as Error)?.message ?? e}`);
    }
    return null;
  }

  private async claimable(coopname: string, member: string, enrollmentId: string): Promise<{ enrollment: EdubridgeEnrollmentRecord; course: EdubridgeCourseRecord }> {
    const enrollment = await this.enrollments.findById(coopname, enrollmentId);
    if (!enrollment || enrollment.member_username !== member) throw DomainError.notFound('EDUBRIDGE_SUBSCRIPTION_NOT_FOUND');
    const course = await this.groups.courseOf(coopname, enrollment.course_id, enrollment.group_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    const claim = await this.claims.findByEnrollment(coopname, enrollment.id);
    if (claim) throw DomainError.badRequest('EDUBRIDGE_GUARANTEE_ALREADY_CLAIMED');
    if (!this.stateOf(enrollment, course, null).available) throw DomainError.badRequest('EDUBRIDGE_GUARANTEE_NOT_AVAILABLE');
    return { enrollment, course };
  }

  private stateOf(enrollment: EdubridgeEnrollmentRecord, course: EdubridgeCourseRecord, claim: EdubridgeGuaranteeClaimRecord | null): GuaranteeState {
    const running = isCancellable(enrollment) && isEntryGuaranteeRunning(course, enrollment, new Date());
    return {
      enrollment_id: enrollment.id,
      available: running && !claim,
      guarantee_until: course.guarantee_days > 0 ? entryGuaranteeEndsAt(course, enrollment) : null,
      amount: enrollment.paid_amount,
      claim,
    };
  }
}

/** Номер заявления: постоянен для подписки, поэтому повторная подача даёт тот же документ, а не второе заявление. */
function claimHashOf(enrollment: EdubridgeEnrollmentRecord): string {
  return createHash('sha256').update(`guarantee:${enrollment.sub_hash}`).digest('hex');
}

function cleanReason(reason: string): string {
  const text = String(reason ?? '').trim();
  if (!text) throw DomainError.badRequest('EDUBRIDGE_GUARANTEE_REASON_REQUIRED');
  return text.slice(0, MAX_REASON);
}

function cleanLinks(links: string[] | undefined): string[] {
  return (links ?? []).map((l) => String(l).trim()).filter(Boolean).slice(0, MAX_LINKS);
}

/** Проект свободного решения в виде документа для публикации — подписей у него ещё нет. */
function projectDocument<M>(project: { hash: string; meta: M }) {
  const meta = project.meta as Record<string, any>;
  return { version: meta?.version || '1.0', hash: project.hash, doc_hash: meta?.doc_hash || project.hash, meta_hash: meta?.meta_hash || project.hash, meta: project.meta, signatures: meta?.signatures || [] };
}

function unsigned(doc: InnerGeneratedDocument): ISignedDocument {
  const meta = doc.meta as Record<string, any>;
  return { version: meta?.version || '1.0', hash: doc.hash, doc_hash: meta?.doc_hash || doc.hash, meta_hash: meta?.meta_hash || doc.hash, meta: doc.meta as ISignedDocument['meta'], signatures: meta?.signatures || [] };
}
