import { Zeus, type Mutations, type Queries } from '@coopenomics/sdk';

export type ILearner = Queries.Edubridge.MyLearners.IOutput['edubridgeMyLearners'][number];
export type IEnrollment = Queries.Edubridge.MyEnrollments.IOutput['edubridgeMyEnrollments'][number];
export type IQuote = Queries.Edubridge.Quote.IOutput['edubridgeQuote'];
export type ILearnerInput = Mutations.Edubridge.AddLearner.IInput['data'];
export type IUpdateLearnerInput = Mutations.Edubridge.UpdateLearner.IInput['data'];
export type IQuoteInput = Queries.Edubridge.Quote.IInput['data'];

// Ключи — имена enum'ов схемы (`Zeus.*`): именно их отдаёт и принимает GraphQL.
export const RECIPIENT_LABELS: Record<string, string> = {
  [Zeus.EduRecipientType.EMAIL]: 'Электронная почта',
  [Zeus.EduRecipientType.TELEGRAM]: 'Telegram',
  [Zeus.EduRecipientType.ONSITE]: 'Очно (код пропуска)',
};

export const PERIOD_LABELS: Record<string, string> = {
  [Zeus.EduEnrollmentPeriod.MONTH]: 'Месяц',
  [Zeus.EduEnrollmentPeriod.YEAR]: 'Год',
};

export const ACCESS_STATE_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduAccessState.NONE]: { label: 'Нет доступа', variant: 'neutral' },
  [Zeus.EduAccessState.PENDING]: { label: 'Выдаётся', variant: 'info' },
  [Zeus.EduAccessState.GRANTED]: { label: 'Доступ выдан', variant: 'pos' },
  [Zeus.EduAccessState.REVOKED]: { label: 'Отозван', variant: 'neutral' },
  [Zeus.EduAccessState.NEEDS_ATTENTION]: { label: 'Требует внимания', variant: 'warn' },
};

export const ENROLLMENT_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduEnrollmentStatus.PENDING]: { label: 'Оформляется', variant: 'info' },
  [Zeus.EduEnrollmentStatus.ACTIVE]: { label: 'Действует', variant: 'pos' },
  [Zeus.EduEnrollmentStatus.EXPIRED]: { label: 'Истекла', variant: 'neutral' },
  [Zeus.EduEnrollmentStatus.REVOKED]: { label: 'Отозвана', variant: 'neg' },
};
