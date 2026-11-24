import { Zeus } from '@coopenomics/sdk';
import type { IMeet } from '../types';
import { t } from 'src/shared/i18n';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import {
  formatDateFromNow,
  formatDateToLocalTimezone,
  getTimezoneLabel,
} from 'src/shared/lib/utils/dates/timezone';

/**
 * Как собрание показывается человеку: короткий бейдж состояния и одна строка
 * уточнения под ним, явка и строка дат. Общее для строки списка собраний и
 * шапки страницы собрания — одно правило, один текст.
 */

export type MeetBadgeVariant = 'neutral' | 'pos' | 'neg' | 'warn' | 'info';

export interface MeetStatusView {
  /** Состояние одним-двумя словами — текст бейджа. */
  label: string;
  variant: MeetBadgeVariant;
  /** Что происходит сейчас или когда — строка под бейджем; пусто, если нечего добавить. */
  detail: string;
}

const S = Zeus.ExtendedMeetStatus;

type MeetRow = NonNullable<NonNullable<IMeet['processing']>['meet']>;

// Кто действует на шаге — фамилия и инициалы; без сертификата — имя аккаунта.
const personName = (certificate: unknown, username: string): string =>
  getShortNameFromCertificate(certificate as never) || username;

const waiting = (row: MeetRow): MeetStatusView => ({
  label: t('meet.statusView.waitingLabel'),
  variant: 'info',
  detail: t('meet.statusView.waitingDetail', { when: formatDateFromNow(row.open_at) }),
});

// Статус собрания → бейдж и уточнение. Статуса нет в таблице — бейджа нет.
const STATUS_VIEWS: Partial<Record<Zeus.ExtendedMeetStatus, (row: MeetRow) => MeetStatusView>> = {
  [S.CREATED]: () => ({ label: t('meet.statusView.createdLabel'), variant: 'warn', detail: t('meet.statusView.createdDetail') }),
  [S.AUTHORIZED]: waiting,
  [S.WAITING_FOR_OPENING]: waiting,
  [S.VOTING_IN_PROGRESS]: (row) => ({
    label: t('meet.statusView.votingLabel'),
    variant: 'pos',
    detail: t('meet.statusView.votingDetail', { when: formatDateFromNow(row.close_at) }),
  }),
  [S.VOTING_COMPLETED]: (row) => ({
    label: t('meet.statusView.protocolLabel'),
    variant: 'warn',
    detail: t('meet.statusView.secretaryDetail', { name: personName(row.secretary_certificate, row.secretary) }),
  }),
  [S.PRECLOSED]: (row) => ({
    label: t('meet.statusView.protocolLabel'),
    variant: 'warn',
    detail: t('meet.statusView.presiderDetail', { name: personName(row.presider_certificate, row.presider) }),
  }),
  [S.CLOSED]: () => ({ label: t('meet.statusView.closedLabel'), variant: 'neutral', detail: t('meet.statusView.closedDetail') }),
  [S.EXPIRED_NO_QUORUM]: () => ({ label: t('meet.statusView.noQuorumLabel'), variant: 'neg', detail: t('meet.statusView.noQuorumDetail') }),
  [S.ONRESTART]: () => ({ label: t('meet.statusView.restartLabel'), variant: 'warn', detail: t('meet.statusView.restartDetail') }),
};

export function meetStatusView(meet: IMeet | null | undefined): MeetStatusView | null {
  const processing = meet?.processing;
  if (!processing?.meet) return null;
  const view = STATUS_VIEWS[processing.extendedStatus];
  return view ? view(processing.meet) : null;
}

/** Номер собрания для заголовка; у собрания без записи в цепи номера нет. */
export function meetNumber(meet: IMeet | null | undefined): number | string | null {
  return meet?.processing?.meet?.id ?? null;
}

/** Строка дат: «24.11.2026, 18:39–18:40 МСК», при разных днях — обе даты полностью. */
export function meetDatesLine(meet: IMeet | null | undefined): string {
  const row = meet?.processing?.meet;
  if (!row?.open_at || !row?.close_at) return '';
  const tz = getTimezoneLabel();
  const openDay = formatDateToLocalTimezone(row.open_at, 'DD.MM.YYYY');
  const closeDay = formatDateToLocalTimezone(row.close_at, 'DD.MM.YYYY');
  const openTime = formatDateToLocalTimezone(row.open_at, 'HH:mm');
  const closeTime = formatDateToLocalTimezone(row.close_at, 'HH:mm');
  return openDay === closeDay
    ? `${openDay}, ${openTime}–${closeTime} ${tz}`
    : `${openDay}, ${openTime} — ${closeDay}, ${closeTime} ${tz}`;
}

/** Вид и форма собрания для мета-строки: «внеочередное · собрание уполномоченных». */
export function meetKindLine(meet: IMeet | null | undefined): string {
  const row = meet?.processing?.meet;
  const parts: string[] = [];
  if (row?.type) parts.push(row.type === 'regular' ? t('meet.statusView.typeRegular') : t('meet.statusView.typeExtra'));
  const participation = meet?.processing?.participation;
  if (participation) parts.push(participation.isTrusteesMeet ? t('meet.statusView.formTrustees') : t('meet.statusView.formMembers'));
  return parts.join(' · ');
}

export interface MeetTurnout {
  /** Явка в процентах, целым числом. */
  percent: number;
  /** Требование кворума в процентах, целым числом. */
  required: number;
  /** Подано бюллетеней. */
  ballots: number;
  reached: boolean;
}

export function meetTurnout(meet: IMeet | null | undefined): MeetTurnout | null {
  const row = meet?.processing?.meet;
  if (!row) return null;
  const percent = Math.round(Number(row.current_quorum_percent ?? 0));
  const required = Math.round(Number(row.quorum_percent ?? 0));
  return {
    percent,
    required,
    ballots: Number(row.signed_ballots ?? 0),
    reached: Boolean(row.quorum_passed),
  };
}
