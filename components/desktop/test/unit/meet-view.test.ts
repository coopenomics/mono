import { describe, expect, it, vi } from 'vitest';

/**
 * Как собрание показывается в строке списка и в шапке страницы (A86-3,
 * переделка страниц собраний 24.11.2026): шаг собрания бейджем, уточнение
 * называет того, кто действует сейчас, строка дат, явка.
 */
vi.mock('src/shared/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => (params ? `${key}|${JSON.stringify(params)}` : key),
}));
vi.mock('src/shared/lib/utils/dates/timezone', () => ({
  formatDateFromNow: () => 'через минуту',
  formatDateToLocalTimezone: (value: string, format = 'DD.MM.YYYY HH:mm') =>
    format === 'DD.MM.YYYY' ? value.slice(0, 10) : format === 'HH:mm' ? value.slice(11, 16) : value,
  getTimezoneLabel: () => 'МСК',
}));

const { meetStatusView, meetDatesLine, meetTurnout, meetKindLine } = await import('src/entities/Meet/lib/view');
const { Zeus } = await import('@coopenomics/sdk');
const S = Zeus.ExtendedMeetStatus;

const person = (last: string, first: string, middle: string) => ({
  __typename: 'IndividualCertificate', first_name: first, last_name: last, middle_name: middle, username: 'x',
});

const meetWith = (status: string, extra: Record<string, unknown> = {}) =>
  ({
    processing: {
      extendedStatus: status,
      participation: { isTrusteesMeet: true },
      meet: {
        type: 'regular',
        open_at: '24.11.2026 18:39',
        close_at: '24.11.2026 18:40',
        secretary: 'sec',
        presider: 'pres',
        secretary_certificate: person('Петров', 'Пётр', 'Петрович'),
        presider_certificate: person('Иванов', 'Иван', 'Иванович'),
        current_quorum_percent: 66.666,
        quorum_percent: 75,
        signed_ballots: 2,
        quorum_passed: false,
        ...extra,
      },
    },
  }) as never;

describe('meet.view — шаг собрания и кто действует', () => {
  it('подписание протокола называет секретаря, затем председателя собрания', () => {
    const secretary = meetStatusView(meetWith(S.VOTING_COMPLETED));
    expect(secretary?.label).toBe('meet.statusView.protocolLabel');
    expect(secretary?.detail).toContain('meet.statusView.secretaryDetail');
    expect(secretary?.detail).toContain('Петров');

    const presider = meetStatusView(meetWith(S.PRECLOSED));
    expect(presider?.detail).toContain('meet.statusView.presiderDetail');
    expect(presider?.detail).toContain('Иванов');
  });

  it('без сертификата действующий назван именем аккаунта', () => {
    expect(meetStatusView(meetWith(S.VOTING_COMPLETED, { secretary_certificate: null }))?.detail).toContain('"sec"');
  });

  it('у каждого шага свой бейдж и цвет', () => {
    const cases: Array<[string, string, string]> = [
      [S.CREATED, 'meet.statusView.createdLabel', 'warn'],
      [S.WAITING_FOR_OPENING, 'meet.statusView.waitingLabel', 'info'],
      [S.AUTHORIZED, 'meet.statusView.waitingLabel', 'info'],
      [S.VOTING_IN_PROGRESS, 'meet.statusView.votingLabel', 'pos'],
      [S.CLOSED, 'meet.statusView.closedLabel', 'neutral'],
      [S.EXPIRED_NO_QUORUM, 'meet.statusView.noQuorumLabel', 'neg'],
      [S.ONRESTART, 'meet.statusView.restartLabel', 'warn'],
    ];
    for (const [status, label, variant] of cases) {
      expect(meetStatusView(meetWith(status))).toMatchObject({ label, variant });
    }
  });

  it('неопределённое состояние бейджа не показывает', () => {
    expect(meetStatusView(meetWith(S.NONE))).toBeNull();
    expect(meetStatusView(null)).toBeNull();
  });
});

describe('meet.view — даты, вид и явка', () => {
  it('один день — дата один раз и интервал времени', () => {
    expect(meetDatesLine(meetWith(S.CLOSED))).toBe('24.11.2026, 18:39–18:40 МСК');
  });

  it('разные дни — обе даты полностью', () => {
    expect(meetDatesLine(meetWith(S.CLOSED, { close_at: '26.11.2026 12:00' }))).toBe('24.11.2026, 18:39 — 26.11.2026, 12:00 МСК');
  });

  it('вид и форма собрания одной строкой', () => {
    expect(meetKindLine(meetWith(S.CLOSED))).toBe('meet.statusView.typeRegular · meet.statusView.formTrustees');
  });

  it('явка и кворум — целыми процентами', () => {
    expect(meetTurnout(meetWith(S.VOTING_IN_PROGRESS))).toEqual({ percent: 67, required: 75, ballots: 2, reached: false });
  });
});
