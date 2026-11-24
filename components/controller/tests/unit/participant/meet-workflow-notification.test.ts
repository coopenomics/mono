import { ExtendedMeetStatus, MonoAccountStatus } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { MeetWorkflowNotificationService } from '~/extensions/participant/meet-workflow-notification.service';
import type { TrackedMeet } from '~/extensions/participant/types';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({
    coopname: 'voskhod',
    frontendUrl: 'https://coop.test',
    timezone: 'Europe/Moscow',
    environment: 'production',
  }),
}));

/**
 * Оповещения о собрании (компонент 76, задача A86-2).
 *
 * Модуль рассылки изолирован: порты уведомлений, аккаунтов и собрания
 * подменены, тест ловит каждую отправку и проверяет адресатов и содержание
 * для всех шести оповещений в обеих формах собрания. Собрание пайщиков —
 * письмо каждому активному пайщику с почтой; собрание уполномоченных — только
 * председателям участков собрания (состав отдаёт ядро через порт собрания).
 */

type Account = {
  username: string;
  provider_account: { email: string; subscriber_id: string; is_registered: boolean; status: string } | null;
  private_account?: unknown;
};

const member = (username: string, overrides: Partial<NonNullable<Account['provider_account']>> = {}): Account => ({
  username,
  provider_account: {
    email: `${username}@coop.test`,
    subscriber_id: `sub-${username}`,
    is_registered: true,
    status: MonoAccountStatus.Active,
    ...overrides,
  },
});

// Пайщики кооператива: три председателя участков, два рядовых, один без
// активации и один без почты — последние двое писем не получают никогда.
const ACCOUNTS: Account[] = [
  member('trusteeone'),
  member('trusteetwo'),
  member('trusteethr'),
  member('memberone'),
  member('membertwo'),
  member('inactive', { status: MonoAccountStatus.Registered }),
  member('noemail', { email: '' }),
];
const ALL_ACTIVE = ['trusteeone', 'trusteetwo', 'trusteethr', 'memberone', 'membertwo'];
const TRUSTEES = ['trusteeone', 'trusteetwo', 'trusteethr'];

const meet: TrackedMeet = {
  id: 7,
  hash: 'abcdef0123',
  coopname: 'voskhod',
  open_at: '2026-12-10T09:00:00',
  close_at: '2026-12-12T09:00:00',
  status: 'authorized',
  extendedStatus: ExtendedMeetStatus.WAITING_FOR_OPENING,
  notifications: {
    initialNotification: false,
    threeDaysBeforeStart: false,
    startNotification: false,
    oneDayBeforeEnd: false,
    restartNotification: false,
    endNotification: false,
  },
} as TrackedMeet;

function build(voters: string[] | null, options: { failingAccounts?: string[] } = {}) {
  const notify = jest.fn(async () => undefined);
  const byName = new Map(ACCOUNTS.map((a) => [a.username, a]));
  const accountPort = {
    getAccount: jest.fn(async (username: string) => {
      if (username === 'voskhod') {
        return { username, provider_account: null, private_account: { organization_data: { short_name: 'ПК «ВОСХОД»' } } };
      }
      if (options.failingAccounts?.includes(username)) throw new Error('аккаунт не найден');
      return byName.get(username);
    }),
    // Две страницы — рассылка собрания пайщиков обязана обойти обе.
    getAccounts: jest.fn(async (_filter: unknown, pagination: { page: number }) => {
      const pages = [ACCOUNTS.slice(0, 4), ACCOUNTS.slice(4)];
      return { items: pages[pagination.page - 1] ?? [], currentPage: pagination.page, totalPages: pages.length };
    }),
  };
  const meetPort = {
    getMeetVoters: jest.fn(async () => voters),
    getMeetDraft: jest.fn(async () => ({ hash: meet.hash, details: '  Отчёт приложен  ' })),
  };
  const logger = { setContext: jest.fn(), log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = new MeetWorkflowNotificationService(
    { notify } as any,
    accountPort as any,
    meetPort as any,
    logger as any
  );
  const recipients = () => (notify.mock.calls as any[]).map(([n]) => n.to.username).sort();
  const sent = () => (notify.mock.calls as any[]).map(([n]) => n);
  return { service, notify, accountPort, meetPort, logger, recipients, sent };
}

// Шесть оповещений собрания: метод рассылки, сценарий каталога, собрание на входе.
const NOTIFICATIONS = [
  { name: 'объявление собрания', send: 'sendInitialNotification', workflow: Workflows.MeetInitial.id, meet },
  { name: 'напоминание до начала', send: 'sendThreeDaysBeforeStartNotification', workflow: Workflows.MeetReminderStart.id, meet },
  { name: 'начало голосования', send: 'sendStartNotification', workflow: Workflows.MeetStarted.id, meet },
  { name: 'напоминание до конца', send: 'sendOneDayBeforeEndNotification', workflow: Workflows.MeetReminderEnd.id, meet },
  { name: 'повторное собрание', send: 'sendRestartNotification', workflow: Workflows.MeetRestart.id, meet },
  {
    name: 'завершение собрания',
    send: 'sendEndNotification',
    workflow: Workflows.MeetEnded.id,
    meet: { ...meet, extendedStatus: ExtendedMeetStatus.VOTING_COMPLETED },
  },
] as const;

describe.each([
  { form: 'собрание пайщиков', voters: null, expected: ALL_ACTIVE },
  { form: 'собрание уполномоченных', voters: TRUSTEES, expected: TRUSTEES },
])('оповещения: $form', ({ voters, expected }) => {
  it.each(NOTIFICATIONS)('$name — адресаты по форме собрания, одно письмо на адресата', async (n) => {
    const { service, recipients, sent, meetPort } = build(voters);
    await expect((service as any)[n.send](n.meet)).resolves.toBe(true);

    expect(meetPort.getMeetVoters).toHaveBeenCalledWith({ coopname: 'voskhod', hash: meet.hash });
    expect(recipients()).toEqual([...expected].sort());
    for (const notification of sent()) {
      expect(notification.workflowId).toBe(n.workflow);
      expect(notification.coopname).toBe('voskhod');
      expect(notification.to).toEqual({
        username: notification.to.username,
        email: `${notification.to.username}@coop.test`,
        subscriberId: `sub-${notification.to.username}`,
      });
      expect(notification.payload.coopShortName).toBe('ПК «ВОСХОД»');
      expect(notification.payload.meetId).toBe(7);
      expect(notification.payload.meetUrl).toBe('https://coop.test/voskhod/user/meets/ABCDEF0123');
    }
  });
});

describe('содержание оповещений', () => {
  it('объявление несёт даты открытия и закрытия, часовой пояс и пояснение к повестке', async () => {
    const { service, sent } = build(TRUSTEES);
    await service.sendInitialNotification(meet);
    const payload = sent()[0].payload;
    expect(payload).toEqual(
      expect.objectContaining({
        meetDate: expect.any(String),
        meetTime: expect.any(String),
        meetEndDate: expect.any(String),
        meetEndTime: expect.any(String),
        timezone: expect.any(String),
        details: 'Отчёт приложен',
      })
    );
  });

  it('напоминание до конца и повторное собрание не передают пояснение — его нет в схемах каталога', async () => {
    for (const send of ['sendOneDayBeforeEndNotification', 'sendRestartNotification'] as const) {
      const { service, sent } = build(TRUSTEES);
      await service[send](meet);
      expect(sent()[0].payload).not.toHaveProperty('details');
    }
  });

  it('завершение без кворума сообщает своё название и текст', async () => {
    const { service, sent } = build(TRUSTEES);
    await service.sendEndNotification({ ...meet, extendedStatus: ExtendedMeetStatus.EXPIRED_NO_QUORUM });
    expect(sent()[0].payload.endType).toBe('EXPIRED_NO_QUORUM');
    expect(sent()[0].payload.endTitle).toContain('7');
  });
});

describe('собрание уполномоченных: адресаты', () => {
  it('аккаунты председателей читаются по имени, все пайщики не перебираются', async () => {
    const { service, accountPort } = build(TRUSTEES);
    await service.sendStartNotification(meet);
    expect(accountPort.getAccounts).not.toHaveBeenCalled();
    for (const trustee of TRUSTEES) expect(accountPort.getAccount).toHaveBeenCalledWith(trustee);
  });

  it('председатель без активации или без почты письма не получает', async () => {
    const { service, recipients } = build(['trusteeone', 'inactive', 'noemail']);
    await service.sendStartNotification(meet);
    expect(recipients()).toEqual(['trusteeone']);
  });

  it('непрочитанный аккаунт председателя выпадает один, остальные письма отправляются', async () => {
    const { service, recipients, logger } = build(TRUSTEES, { failingAccounts: ['trusteetwo'] });
    await expect(service.sendStartNotification(meet)).resolves.toBe(true);
    expect(recipients()).toEqual(['trusteeone', 'trusteethr']);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('trusteetwo'));
  });

  it('пустой состав голосующих — рассылка не выполнена, трекер повторит её позже', async () => {
    const { service, notify } = build([]);
    await expect(service.sendInitialNotification(meet)).resolves.toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it('сбой чтения состава — рассылка не выполнена, всем пайщикам письмо не отправляется', async () => {
    const { service, notify, meetPort } = build(TRUSTEES);
    meetPort.getMeetVoters.mockRejectedValueOnce(new Error('цепь не отвечает'));
    await expect(service.sendInitialNotification(meet)).resolves.toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
});
