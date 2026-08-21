import type { Mutations, Queries } from '@coopenomics/sdk';

export type ILearner = Queries.Edubridge.MyLearners.IOutput['edubridgeMyLearners'][number];
export type IEnrollment = Queries.Edubridge.MyEnrollments.IOutput['edubridgeMyEnrollments'][number];
export type IQuote = Queries.Edubridge.Quote.IOutput['edubridgeQuote'];
export type ILearnerInput = Mutations.Edubridge.AddLearner.IInput['data'];
export type IUpdateLearnerInput = Mutations.Edubridge.UpdateLearner.IInput['data'];
export type IQuoteInput = Queries.Edubridge.Quote.IInput['data'];

export const RECIPIENT_LABELS: Record<string, string> = {
  email: 'Электронная почта',
  telegram: 'Telegram',
  onsite: 'Очно (код пропуска)',
};

export const PERIOD_LABELS: Record<string, string> = { month: 'Месяц', year: 'Год' };

export const ACCESS_STATE_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  none: { label: 'Нет доступа', variant: 'neutral' },
  pending: { label: 'Выдаётся', variant: 'info' },
  granted: { label: 'Доступ выдан', variant: 'pos' },
  revoked: { label: 'Отозван', variant: 'neutral' },
  needs_attention: { label: 'Требует внимания', variant: 'warn' },
};

export const ENROLLMENT_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  pending: { label: 'Оформляется', variant: 'info' },
  active: { label: 'Действует', variant: 'pos' },
  expired: { label: 'Истекла', variant: 'neutral' },
  revoked: { label: 'Отозвана', variant: 'neg' },
};
