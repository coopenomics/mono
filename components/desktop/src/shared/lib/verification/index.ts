import {
  deriveVerificationTypes,
  verificationTypeLabel,
  verificationTypeShortLabel,
} from '@coopenomics/auth';

/** Данные аккаунта, достаточные для вывода уровней верификации. */
export interface VerificationSourceAccount {
  participant_account?: { status?: string | null; created_at?: string | null } | null;
  user_account?: {
    verifications?: Array<{
      verificator: string;
      is_verified: boolean;
      procedure: string;
      created_at: string;
      last_update?: string;
      notice?: string;
    }> | null;
  } | null;
}

/** Уровень верификации в готовом для UI виде. */
export interface ParticipantVerificationView {
  type: string;
  /** Короткое имя уровня — для чипа/бейджа («Начальный», «Базовый»). */
  short: string;
  /** Полное описание уровня — для тултипа/строки. */
  label: string;
  /** «с 01.02.2026 · подтвердил trustee1» — пусто, если данных нет. */
  hint: string;
}

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU');
};

/**
 * Уровни верификации пайщика из данных его аккаунта — единый маппинг
 * (`deriveVerificationTypes` из `@coopenomics/auth`) для реестра пайщиков,
 * карточек и лент: клиенты не дублируют логику ядра.
 */
export function participantVerificationView(account: VerificationSourceAccount): ParticipantVerificationView[] {
  return deriveVerificationTypes({
    participant_account: account.participant_account ?? null,
    user_account: account.user_account ?? null,
  }).map((entry) => ({
    type: entry.type,
    short: verificationTypeShortLabel(entry.type),
    label: verificationTypeLabel(entry.type),
    hint: [
      entry.verified_at ? `с ${formatDate(entry.verified_at)}` : '',
      entry.attested_by ? `подтвердил ${entry.attested_by}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}
