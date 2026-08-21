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

/** Как называть верификатора и участок в подписи уровня. */
export interface VerificationNaming {
  /** Человеческое имя пайщика-верификатора по имени аккаунта. */
  attestorName?: (username: string) => string;
  /** Человеческое название кооперативного участка по его имени в цепи. */
  branchName?: (braname: string) => string;
}

/** Уровень верификации в готовом для UI виде. */
export interface ParticipantVerificationView {
  type: string;
  /** Короткое имя уровня — для чипа/бейджа («Начальный», «Базовый»). */
  short: string;
  /** Полное описание уровня — для тултипа/строки. */
  label: string;
  /** «с 01.02.2026 · подтвердил Иванов И.И., совет кооператива» — пусто, если данных нет. */
  hint: string;
  /** Кто провёл верификацию (аккаунт); пусто у деривативных уровней. */
  attestedBy: string;
  /** Участок, где сверена личность; пусто — сверял совет кооператива. */
  attestedIn: string;
}

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU');
};

/**
 * Кто и где подтвердил уровень: имена показываем человеческие, служебные
 * account-id и имена участков — только когда человеческого имени нет.
 */
const formatAttestation = (
  entry: { attested_by?: string; attested_in?: string },
  naming: VerificationNaming,
): string => {
  if (!entry.attested_by) return '';
  const who = naming.attestorName?.(entry.attested_by) || entry.attested_by;
  const where = entry.attested_in
    ? `участок «${naming.branchName?.(entry.attested_in) || entry.attested_in}»`
    : 'совет кооператива';
  return `подтвердил ${who}, ${where}`;
};

/** Подтверждённый уровень, как он приходит из ядра или из удостоверения. */
export interface VerificationEntrySource {
  type: string;
  verified_at?: string;
  attested_by?: string;
  attested_in?: string;
}

/**
 * Один уровень верификации в готовом для UI виде. Используется и реестром
 * пайщиков (уровни из данных аккаунта), и личным кабинетом (уровни из
 * удостоверения) — подпись уровня везде одна и та же.
 */
export function verificationLevelView(
  entry: VerificationEntrySource,
  naming: VerificationNaming = {},
): ParticipantVerificationView {
  return {
    type: entry.type,
    short: verificationTypeShortLabel(entry.type),
    label: verificationTypeLabel(entry.type),
    hint: [
      entry.verified_at ? `с ${formatDate(entry.verified_at)}` : '',
      formatAttestation(entry, naming),
    ]
      .filter(Boolean)
      .join(' · '),
    attestedBy: entry.attested_by ?? '',
    attestedIn: entry.attested_in ?? '',
  };
}

/**
 * Уровни верификации пайщика из данных его аккаунта — единый маппинг
 * (`deriveVerificationTypes` из `@coopenomics/auth`) для реестра пайщиков,
 * карточек и лент: клиенты не дублируют логику ядра.
 */
export function participantVerificationView(
  account: VerificationSourceAccount,
  naming: VerificationNaming = {},
): ParticipantVerificationView[] {
  return deriveVerificationTypes({
    participant_account: account.participant_account ?? null,
    user_account: account.user_account ?? null,
  }).map((entry) => verificationLevelView(entry, naming));
}

/** Данные пайщика для сверки с документом (плоский набор полей от сервера). */
export interface VerificationIdentity {
  type: string;
  full_name: string;
  birthdate?: string | null;
  passport_series?: string | null;
  passport_number?: string | null;
  passport_issued_by?: string | null;
  passport_issued_at?: string | null;
  passport_code?: string | null;
  full_address?: string | null;
  inn?: string | null;
  ogrn?: string | null;
  representative_name?: string | null;
  representative_position?: string | null;
  representative_based_on?: string | null;
}

/** Строка сверки: длинные значения (адрес, кем выдан) идут в две строки. */
export interface VerificationIdentityFact {
  label: string;
  value: string;
  wide?: boolean;
}

/**
 * Что показать на экране сверки личности. Паспорт проверяют целиком — ФИО,
 * дата рождения, серия и номер, кем и когда выдан, код подразделения, адрес
 * регистрации, — иначе «сверка» сводится к взгляду на две цифры. У ИП и
 * организаций паспорта в кооперативе нет: показываем то, по чему сверяют
 * личность и полномочия. Пустые поля не выводим.
 */
export function verificationIdentityFacts(
  identity: VerificationIdentity,
  formatDate: (value?: string | null) => string,
): VerificationIdentityFact[] {
  const facts: VerificationIdentityFact[] = [];

  if (identity.type === 'organization') {
    facts.push({ label: 'Представитель', value: identity.representative_name ?? '', wide: true });
    facts.push({ label: 'Должность', value: identity.representative_position ?? '' });
    facts.push({ label: 'Действует на основании', value: identity.representative_based_on ?? '', wide: true });
    facts.push({ label: 'ИНН', value: identity.inn ?? '' });
    facts.push({ label: 'ОГРН', value: identity.ogrn ?? '' });
    facts.push({ label: 'Юридический адрес', value: identity.full_address ?? '', wide: true });
    return facts.filter((fact) => fact.value);
  }

  facts.push({ label: 'Дата рождения', value: formatDate(identity.birthdate) });

  if (identity.type === 'entrepreneur') {
    facts.push({ label: 'Адрес регистрации', value: identity.full_address ?? '', wide: true });
    facts.push({ label: 'ИНН', value: identity.inn ?? '' });
    facts.push({ label: 'ОГРНИП', value: identity.ogrn ?? '' });
    return facts.filter((fact) => fact.value);
  }

  const series = identity.passport_series ?? '';
  const number = identity.passport_number ?? '';
  if (series || number) facts.push({ label: 'Серия и номер', value: `${series} ${number}`.trim() });
  facts.push({ label: 'Кем выдан', value: identity.passport_issued_by ?? '', wide: true });
  facts.push({ label: 'Дата выдачи', value: formatDate(identity.passport_issued_at) });
  facts.push({ label: 'Код подразделения', value: identity.passport_code ?? '' });
  facts.push({ label: 'Адрес регистрации', value: identity.full_address ?? '', wide: true });
  return facts.filter((fact) => fact.value);
}

/** Что именно просят сверить — набор данных зависит от типа пайщика. */
export function verificationHint(type: string): string {
  return type === 'individual'
    ? 'Сверьте с оригиналом паспорта все данные выше: фамилию, имя, отчество, дату рождения, серию и номер, кем и когда выдан, код подразделения и адрес регистрации. Подтверждение записывается в цепи от вашего имени и делается один раз.'
    : 'Сверьте данные выше с документом, удостоверяющим личность, и с документом о полномочиях. Подтверждение записывается в цепи от вашего имени и делается один раз.';
}
