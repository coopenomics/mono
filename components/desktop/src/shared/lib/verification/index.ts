import {
  deriveVerificationTypes,
  highestVerificationType,
  verificationTypeLabel,
  verificationTypeShortLabel,
} from '@coopenomics/auth';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';

/**
 * Данные аккаунта, достаточные для вывода уровней верификации.
 *
 * Даты пайщик-записи описаны как `unknown`: в схеме это кастомный скаляр
 * `DateTime`, и SDK отдаёт его именно так. Приводим к строке на входе в ядро
 * (`toIsoDate`), а не требуем от вызывающих кастовать у себя — иначе каждый
 * экран с реестром пайщиков обзаводится своим приведением.
 */
export interface VerificationSourceAccount {
  participant_account?: { status?: string | null; created_at?: unknown } | null;
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
  const participant = account.participant_account;
  return deriveVerificationTypes({
    participant_account: participant
      ? { status: participant.status ?? null, created_at: toIsoDate(participant.created_at) }
      : null,
    user_account: account.user_account ?? null,
  }).map((entry) => verificationLevelView(entry, naming));
}

/** Скаляр DateTime из SDK — ISO-строка; всё остальное уровню даты не даёт. */
function toIsoDate(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

/**
 * Цвет ступени. Уровни идут цепочкой снизу вверх, и цвет показывает, докуда
 * пайщик поднялся: синий — вступил, зелёный — личность сверена с документом.
 * Новый уровень получает свой цвет здесь; незнакомому даём нейтральный, чтобы
 * не выдать его за подтверждённый сильнее, чем он есть.
 */
const LEVEL_VARIANTS: Record<string, BaseBadgeVariant> = {
  coop_baseline: 'info',
  passport_onsite: 'pos',
};

export function verificationBadgeVariant(type: string): BaseBadgeVariant {
  return LEVEL_VARIANTS[type] ?? 'neutral';
}

/**
 * Текущий уровень пайщика — самый высокий из достигнутых. Показываем ровно
 * один: уровни складываются в лестницу, и человеку важно, докуда он поднялся,
 * а не перечень пройденных ступеней. Отзовут верхний — останется предыдущий.
 */
export function highestVerificationLevel(
  levels: ParticipantVerificationView[],
): ParticipantVerificationView | null {
  const type = highestVerificationType(levels.map((level) => level.type));
  return levels.find((level) => level.type === type) ?? null;
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

/** Форматирование даты документа — приходит от вызывающего слоя. */
type DateFormatter = (value?: string | null) => string;

/** Организация: сверяют полномочия представителя и реквизиты юрлица. */
function organizationFacts(identity: VerificationIdentity): VerificationIdentityFact[] {
  return [
    { label: 'Представитель', value: identity.representative_name ?? '', wide: true },
    { label: 'Должность', value: identity.representative_position ?? '' },
    { label: 'Действует на основании', value: identity.representative_based_on ?? '', wide: true },
    { label: 'ИНН', value: identity.inn ?? '' },
    { label: 'ОГРН', value: identity.ogrn ?? '' },
    { label: 'Юридический адрес', value: identity.full_address ?? '', wide: true },
  ];
}

/** ИП: паспорта в кооперативе нет, сверяют лицо и регистрационные данные. */
function entrepreneurFacts(identity: VerificationIdentity, formatDate: DateFormatter): VerificationIdentityFact[] {
  return [
    { label: 'Дата рождения', value: formatDate(identity.birthdate) },
    { label: 'Адрес регистрации', value: identity.full_address ?? '', wide: true },
    { label: 'ИНН', value: identity.inn ?? '' },
    { label: 'ОГРНИП', value: identity.ogrn ?? '' },
  ];
}

/** Физлицо: паспорт проверяют целиком, иначе сверка сводится к двум цифрам. */
function individualFacts(identity: VerificationIdentity, formatDate: DateFormatter): VerificationIdentityFact[] {
  const passport = [identity.passport_series ?? '', identity.passport_number ?? ''].join(' ').trim();
  return [
    { label: 'Дата рождения', value: formatDate(identity.birthdate) },
    { label: 'Серия и номер', value: passport },
    { label: 'Кем выдан', value: identity.passport_issued_by ?? '', wide: true },
    { label: 'Дата выдачи', value: formatDate(identity.passport_issued_at) },
    { label: 'Код подразделения', value: identity.passport_code ?? '' },
    { label: 'Адрес регистрации', value: identity.full_address ?? '', wide: true },
  ];
}

/**
 * Что показать на экране сверки личности. Набор полей зависит от типа пайщика:
 * у физлица сверяют весь паспорт и адрес регистрации, у ИП и организации
 * паспорта в кооперативе нет — сверяют личность и полномочия. Пустые поля не
 * выводим: пустая строка на экране сверки читается как «данных нет», а не как
 * «поле не заполнено».
 */
export function verificationIdentityFacts(
  identity: VerificationIdentity,
  formatDate: DateFormatter,
): VerificationIdentityFact[] {
  const facts =
    identity.type === 'organization'
      ? organizationFacts(identity)
      : identity.type === 'entrepreneur'
        ? entrepreneurFacts(identity, formatDate)
        : individualFacts(identity, formatDate);
  return facts.filter((fact) => fact.value);
}

/** Что именно просят сверить — набор данных зависит от типа пайщика. */
export function verificationHint(type: string): string {
  return type === 'individual'
    ? 'Сверьте с оригиналом паспорта все данные выше: фамилию, имя, отчество, дату рождения, серию и номер, кем и когда выдан, код подразделения и адрес регистрации. Подтверждение записывается в цепи от вашего имени и делается один раз.'
    : 'Сверьте данные выше с документом, удостоверяющим личность, и с документом о полномочиях. Подтверждение записывается в цепи от вашего имени и делается один раз.';
}
