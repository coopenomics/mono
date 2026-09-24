import { Zeus, type Mutations, type Queries } from '@coopenomics/sdk';
import { t } from '../../../i18n';

export type ILearner = Queries.Edubridge.MyLearners.IOutput['edubridgeMyLearners'][number];
export type IEnrollment = Queries.Edubridge.MyEnrollments.IOutput['edubridgeMyEnrollments'][number];
export type IQuote = Queries.Edubridge.Quote.IOutput['edubridgeQuote'];
export type ILearnerInput = Mutations.Edubridge.AddLearner.IInput['data'];
export type IUpdateLearnerInput = Mutations.Edubridge.UpdateLearner.IInput['data'];
export type IQuoteInput = Queries.Edubridge.Quote.IInput['data'];
export type IRefundPreview = Queries.Edubridge.RefundPreview.IOutput['edubridgeRefundPreview'];

// Ключи — имена enum'ов схемы (`Zeus.*`): именно их отдаёт и принимает GraphQL.
export const RECIPIENT_LABELS: Record<string, string> = {
  [Zeus.EduRecipientType.EMAIL]: t('edubridge.learner.recipient.EMAIL'),
  [Zeus.EduRecipientType.TELEGRAM]: 'Telegram',
  [Zeus.EduRecipientType.ONSITE]: t('edubridge.learner.recipient.ONSITE'),
};

/** Год — только у подписок, открытых до взноса за весь курс; новые так не оформляются. */
export const PERIOD_LABELS: Record<string, string> = {
  [Zeus.EduEnrollmentPeriod.MONTH]: t('edubridge.enrollment.period.MONTH'),
  [Zeus.EduEnrollmentPeriod.COURSE]: t('edubridge.enrollment.period.COURSE'),
  [Zeus.EduEnrollmentPeriod.YEAR]: t('edubridge.enrollment.period.YEAR'),
};

export const ACCESS_STATE_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduAccessState.NONE]: { label: t('edubridge.access.status.NONE'), variant: 'neutral' },
  [Zeus.EduAccessState.PENDING]: { label: t('edubridge.access.status.PENDING'), variant: 'info' },
  [Zeus.EduAccessState.GRANTED]: { label: t('edubridge.access.status.GRANTED'), variant: 'pos' },
  [Zeus.EduAccessState.REVOKED]: { label: t('edubridge.access.status.REVOKED'), variant: 'neutral' },
  [Zeus.EduAccessState.NEEDS_ATTENTION]: { label: t('edubridge.access.status.NEEDS_ATTENTION'), variant: 'warn' },
};

export const ENROLLMENT_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduEnrollmentStatus.PENDING]: { label: t('edubridge.enrollment.status.PENDING'), variant: 'info' },
  [Zeus.EduEnrollmentStatus.ACTIVE]: { label: t('edubridge.enrollment.status.ACTIVE'), variant: 'pos' },
  [Zeus.EduEnrollmentStatus.EXPIRED]: { label: t('edubridge.enrollment.status.EXPIRED'), variant: 'neutral' },
  [Zeus.EduEnrollmentStatus.REVOKED]: { label: t('edubridge.enrollment.status.REVOKED'), variant: 'neg' },
  [Zeus.EduEnrollmentStatus.CANCELLED]: { label: t('edubridge.enrollment.status.CANCELLED'), variant: 'neutral' },
};

/** Основания возврата по Положению ЦПП — языком ученика. */
export const REFUND_REASON_LABELS: Record<string, string> = {
  before_start: t('edubridge.refund.reason.before_start'),
  underfilled: t('edubridge.refund.reason.underfilled'),
  refusal: t('edubridge.refund.reason.refusal'),
};
