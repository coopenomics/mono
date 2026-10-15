import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Cooperative } from 'cooptypes';
import { chainErrorCode, DomainError } from '@coopenomics/extension-kit';
import {
  COUNCIL_PORT,
  DOCUMENT_PORT,
  LOGGER_PORT,
  type ICouncilPort,
  type IDocumentPort,
  type ILoggerPort,
  type InnerDocumentAggregate,
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

  /** Подписанное заявление участника — документом, как он его подписал; чужое заявление не отдаётся. */
  async claimDocument(coopname: string, member: string, claimId: string): Promise<InnerDocumentAggregate | null> {
    const claim = await this.claims.findById(coopname, claimId);
    if (!claim || claim.member_username !== member) throw DomainError.notFound('EDUBRIDGE_GUARANTEE_CLAIM_NOT_FOUND');
    return this.documents.buildAggregate(claim.statement_document as unknown as ISignedDocument);
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
   * Подача: заявление публикуется в цепи, и контракт тем же действием ставит
   * его в повестку совета. Номер вопроса читается следом; не прочитался —
   * его дочитывает очередь.
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
      this.logger.warn(`[EDU.GUARANTEE] заявление по подписке ${enrollment.sub_hash} уже в цепи — продолжаем с номера вопроса`);
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
      return await this.publish(coopname, saved);
    } catch (e) {
      this.logger.error(`[EDU.GUARANTEE] вопрос по заявлению ${saved.claim_hash} совету не вынесен: ${(e as Error)?.message ?? e}`);
      return saved;
    }
  }

  /** Заявления, у которых номер вопроса совета не прочитался при подаче, — его дочитывает очередь. */
  async publishPending(coopname: string): Promise<number> {
    let published = 0;
    for (const claim of await this.claims.findSubmittedWithoutProject(coopname)) {
      try {
        if ((await this.publish(coopname, claim)).council_agenda_id) published += 1;
      } catch (e) {
        this.logger.error(`[EDU.GUARANTEE] вопрос по заявлению ${claim.claim_hash} совету не вынесен: ${(e as Error)?.message ?? e}`);
      }
    }
    return published;
  }

  /**
   * Совет удовлетворил заявление (`edubridge::onwarrauth` из `soviet::exec`):
   * протокол 3014 подписан председателем и пришёл с действием, контракт уже
   * аннулировал подписку и вернул взнос. Заявление закрывается, запись
   * подписки приводится к цепи, доступ отзывается.
   */
  async onCouncilApproved(coopname: string, subHash: string, authorization: ISignedDocument | undefined): Promise<void> {
    const enrollment = await this.enrollments.findBySubHash(subHash);
    if (!enrollment || enrollment.coopname !== coopname) return;
    const claim = await this.claims.findByEnrollment(coopname, enrollment.id);
    if (!claim || claim.status !== EduGuaranteeClaimStatus.SUBMITTED) return;
    const meta = (authorization?.meta ?? {}) as Record<string, unknown>;
    if (meta.decision_id !== undefined && meta.decision_id !== null) claim.council_decision_id = String(meta.decision_id);
    if (authorization?.hash) claim.decision_hash = authorization.hash.toLowerCase();
    claim.decided_at = new Date();
    claim.status = EduGuaranteeClaimStatus.APPROVED;
    await this.claims.save(claim);
    // Подписка могла закрыться, пока совет решал: возвращать по ней уже нечего, решение остаётся в заявлении.
    if (isCancellable(enrollment)) await this.enrollmentService.cancelByGuarantee(coopname, enrollment, claim.amount);
    this.logger.info(`[EDU.GUARANTEE] заявление ${claim.claim_hash} удовлетворено: подписка аннулирована, ${claim.amount} возвращено на паевой`);
  }

  /** Совет отказал (`edubridge::onwarrdecl`): контракт снял заморозку взноса сам, заявление закрывается. */
  async onCouncilDeclinedBySub(coopname: string, subHash: string): Promise<void> {
    const enrollment = await this.enrollments.findBySubHash(subHash);
    if (!enrollment || enrollment.coopname !== coopname) return;
    const claim = await this.claims.findByEnrollment(coopname, enrollment.id);
    if (!claim || claim.status !== EduGuaranteeClaimStatus.SUBMITTED) return;
    claim.status = EduGuaranteeClaimStatus.DECLINED;
    claim.decided_at = new Date();
    await this.claims.save(claim);
    this.logger.info(`[EDU.GUARANTEE] заявление ${claim.claim_hash}: совет отказал`);
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

  /**
   * Вопрос совету ставит сам контракт (`warrclaim` → `soviet::createagenda`,
   * тип `eduguarantee`, hash = хэш подписки, документ — заявление 3013). Здесь
   * запоминается номер вопроса: по нему приходит снятие по сроку.
   */
  private async publish(coopname: string, claim: EdubridgeGuaranteeClaimRecord): Promise<EdubridgeGuaranteeClaimRecord> {
    if (claim.council_agenda_id) return claim;
    const enrollment = await this.enrollments.findById(coopname, claim.enrollment_id);
    if (!enrollment) return claim;
    const agendaId = await this.lookupAgendaId(coopname, enrollment.sub_hash);
    // Номер не прочитался — запись остаётся без него, и очередь спросит снова.
    if (!agendaId) return claim;
    claim.council_agenda_id = agendaId;
    claim.council_project_hash = enrollment.sub_hash.toLowerCase();
    return this.claims.save(claim);
  }

  /** Номер вопроса в повестке совета по хэшу подписки: по нему придёт отклонение либо снятие по сроку. */
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
