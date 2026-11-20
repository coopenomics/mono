import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  contentAsset,
  contentDay,
  contentFact,
  contentMoney,
  platformSettings,
  processContentRegistry,
  type ProcessContentDTO,
  type ProcessContentProvider,
} from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeTeacherKyselyRepository } from '../../infrastructure/repositories/edubridge-teacher.kysely-repository';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { t, te } from '../../i18n';

/** Процессы ЦПП «Образование» с сущностью на узле: хэш процесса — ключ записи. */
const ACCESS = 'p.edu.access'; // i18n-ignore
const RID = 'p.edu.rid'; // i18n-ignore
const TEACH = 'p.edu.teach'; // i18n-ignore

/** Подпись состояния из словаря; неизвестный код показывается как есть. */
function statusLabel(group: string, code: string | null | undefined): string | null {
  if (!code) return null;
  const key = `edubridge.processContent.${group}.${code}`;
  return te(key) ? t(key) : code;
}

/**
 * Содержание процессов ЦПП «Образование» для стола бухгалтера: какой курс и
 * кто учится, какой результат передал преподаватель, какой договор подписан.
 * Учёт и документы процесса стол показывает сам.
 */
@Injectable()
export class EdubridgeProcessContentService implements OnModuleInit, ProcessContentProvider {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly teachers: EdubridgeTeacherKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort
  ) {}

  onModuleInit(): void {
    processContentRegistry.register([ACCESS, RID, TEACH], this);
  }

  async content(processHash: string, coopname: string, processType: string): Promise<ProcessContentDTO | null> {
    const hash = processHash.toLowerCase();
    if (processType === ACCESS) return this.access(hash, coopname);
    if (processType === RID) return this.rid(hash);
    if (processType === TEACH) return this.teach(hash, coopname);
    return null;
  }

  /** Доступ к курсу: хэш процесса — хэш подписки. */
  private async access(hash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const sub = await this.enrollments.findBySubHash(hash);
    if (!sub) return null;
    const course = await this.courses.findById(coopname, sub.course_id);
    const member = await this.nameOf(sub.member_username);
    return {
      title: course?.title || t('edubridge.processContent.access.untitled'),
      subtitle: member,
      image_url: null,
      amount: this.asset(sub.paid_amount),
      amount_label: t('edubridge.processContent.access.amountLabel'),
      status: statusLabel('accessStatus', sub.status),
      facts: [
        ...contentFact(t('edubridge.processContent.access.member'), member),
        ...contentFact(t('edubridge.processContent.access.paidMonths'), sub.paid_months),
        ...contentFact(t('edubridge.processContent.access.paidUntil'), contentDay(sub.paid_until)),
        ...contentFact(t('edubridge.processContent.access.joinedAt'), contentDay(sub.joined_at)),
        ...contentFact(t('edubridge.processContent.access.cancelledAt'), contentDay(sub.cancelled_at)),
        ...contentFact(t('edubridge.processContent.access.refunded'), this.money(sub.refunded_amount)),
        ...contentFact(t('edubridge.processContent.access.refundReason'), sub.refund_reason),
      ],
      links: [],
    };
  }

  /** Паевой взнос преподавателя результатом интеллектуальной деятельности. */
  private async rid(hash: string): Promise<ProcessContentDTO | null> {
    const rid = await this.teachers.findContributionByRidHash(hash);
    if (!rid) return null;
    const teacher = await this.nameOf(rid.teacher_username);
    return {
      title: rid.description || t('edubridge.processContent.rid.untitled'),
      subtitle: teacher,
      image_url: null,
      amount: this.asset(rid.amount),
      amount_label: t('edubridge.processContent.rid.amountLabel'),
      status: statusLabel('ridStatus', rid.status),
      facts: [
        ...contentFact(t('edubridge.processContent.rid.teacher'), teacher),
        ...contentFact(t('edubridge.processContent.rid.holdUntil'), contentDay(rid.hold_until)),
        ...contentFact(t('edubridge.processContent.rid.decidedAt'), contentDay(rid.decided_at)),
        ...contentFact(t('edubridge.processContent.rid.declineReason'), rid.decline_reason),
      ],
      links: [],
    };
  }

  /** Участие преподавателя в хозяйственной деятельности: договор преподавателя. */
  private async teach(hash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const contract = await this.teachers.findContractByHash(coopname, hash);
    if (!contract) return null;
    const teacher = await this.nameOf(contract.teacher_username);
    return {
      title: t('edubridge.processContent.teach.title', { number: contract.contract_number ?? '' }),
      subtitle: teacher,
      image_url: null,
      amount: null,
      amount_label: null,
      status: statusLabel('teachStatus', contract.status),
      facts: [
        ...contentFact(t('edubridge.processContent.teach.teacher'), teacher),
        ...contentFact(t('edubridge.processContent.teach.hourlyRate'), this.money(contract.hourly_rate)),
        ...contentFact(t('edubridge.processContent.teach.approvedAt'), contentDay(contract.approved_at)),
        ...contentFact(t('edubridge.processContent.teach.signedAt'), contentDay(contract.signed_at)),
        ...contentFact(t('edubridge.processContent.teach.declineReason'), contract.decline_reason),
      ],
      links: [],
    };
  }

  private asset(amount: string | number | null | undefined): string | null {
    const { rootGovernSymbol: symbol, rootGovernPrecision: precision } = platformSettings().blockchain;
    return contentAsset(amount, symbol, precision);
  }

  private money(amount: string | number | null | undefined): string {
    if (amount === null || amount === undefined || Number(String(amount).split(' ')[0]) === 0) return '';
    return contentMoney(amount, platformSettings().blockchain.rootGovernSymbol);
  }

  /** ФИО пайщика; без имени — учётное имя. */
  private async nameOf(account: string | null | undefined): Promise<string> {
    if (!account) return '';
    try {
      return (await this.accounts.getDisplayName(account)) || account;
    } catch {
      return account;
    }
  }
}
