import { configurePlatformSettings, platformSettings } from '@coopenomics/extension-kit';
import { MonoAccountStatus } from '@coopenomics/innercoop';
import { GreetingsSenderService } from '~/extensions/greetings/application/services/greetings-sender.service';
import { GreetingSendStatus, GreetingSkipReason, GreetingTemplateStatus, GreetingAccountType } from '~/extensions/greetings/domain/greetings.enums';
import type { GreetingCalendarRecord, GreetingSendRecord, GreetingTemplateRecord } from '~/extensions/greetings/infrastructure/database/greetings.records';

/**
 * Рассылка поздравлений: одно письмо на пайщика в год. Принятое к доставке
 * письмо не повторяется, пропуск и ошибка повторяются следующим запуском —
 * иначе пайщик либо получит два письма, либо останется без поздравления.
 */

/** Журнал в памяти: ровно то, чем рассылка пользуется у шлюза таблицы. */
function memorySends() {
  const rows: GreetingSendRecord[] = [];
  let seq = 0;
  return {
    rows,
    async findOne(where: Partial<GreetingSendRecord>) {
      return rows.find((row) => row.username === where.username && row.year === where.year) ?? null;
    },
    async save(record: Partial<GreetingSendRecord>) {
      const existing = record.id ? rows.find((row) => row.id === record.id) : undefined;
      if (existing) return Object.assign(existing, record);
      const row = { ...record, id: `send-${++seq}` } as GreetingSendRecord;
      rows.push(row);
      return row;
    },
  };
}

const entry: GreetingCalendarRecord = {
  username: 'anna',
  account_type: GreetingAccountType.INDIVIDUAL,
  birth_year: 1990,
  birth_month: 6,
  birth_day: 15,
  updated_at: new Date(),
};

const template = {
  id: 'tpl-2026',
  title: 'Поздравление на 2026 год',
  status: GreetingTemplateStatus.ACTIVE,
  period_start: '2026-01-01',
  period_end: '2026-12-31',
  subject: '{{Обращение}}, с днём рождения!',
  body: 'Поздравляем с {{Летие}}',
} as GreetingTemplateRecord;

function account(status: MonoAccountStatus, email = 'anna@example.com') {
  return {
    username: 'anna',
    provider_account: { status, is_registered: true, email, subscriber_id: email ? 'sub-anna' : '' },
    private_account: { type: 'individual', individual_data: { first_name: 'Анна', middle_name: 'Петровна', last_name: 'Иванова' } },
  };
}

function build(options: { status?: MonoAccountStatus; email?: string; notify?: jest.Mock } = {}) {
  const sends = memorySends();
  const notify = options.notify ?? jest.fn().mockResolvedValue({ acknowledged: true, outboxIds: ['o1'] });
  const people = {
    person: jest.fn().mockResolvedValue({
      username: 'anna',
      account: account(options.status ?? MonoAccountStatus.Active, options.email),
      accountType: GreetingAccountType.INDIVIDUAL,
      lastName: 'Иванова',
      firstName: 'Анна',
      middleName: 'Петровна',
      birthdate: '1990-06-15',
    }),
    signature: jest.fn().mockResolvedValue({ cooperative: 'ПК «Восход»', chairman: 'Петров Пётр Петрович' }),
  };
  const letters = { letter: jest.fn().mockResolvedValue({ subject: 'Анна Петровна, с днём рождения!', bodyHtml: '<p>…</p>' }) };
  const calendar = { celebratingOn: jest.fn().mockResolvedValue([entry]) };
  const templates = { forDate: jest.fn().mockResolvedValue(template) };
  const logger = { setContext: jest.fn(), info: jest.fn(), error: jest.fn() };
  const sender = new GreetingsSenderService(
    sends as never,
    calendar as never,
    templates as never,
    letters as never,
    people as never,
    { notifyUser: notify } as never,
    logger as never
  );
  return { sender, sends, notify, templates };
}

beforeAll(() => {
  try {
    platformSettings();
  } catch {
    configurePlatformSettings({
      coopname: 'voskhod',
      frontendUrl: 'http://localhost',
      backendUrl: 'http://localhost',
      timezone: 'Europe/Moscow',
      environment: 'test',
      blockchain: { rootSymbol: 'AXON', rootPrecision: 4, rootGovernSymbol: 'RUB', rootGovernPrecision: 4 } as never,
    });
  }
});

// 15 июня 2026, 10:00 по Москве.
const BIRTHDAY_MORNING = new Date('2026-06-15T07:00:00Z');

describe('поздравления: рассылка', () => {
  it('в день рождения отправляет письмо и пишет одну строку журнала', async () => {
    const { sender, sends, notify } = build();
    const result = await sender.run(9, BIRTHDAY_MORNING);
    expect(result).toMatchObject({ celebrants: 1, sent: 1 });
    expect(notify).toHaveBeenCalledWith('anna', 'pozdravlenie-s-dnem-rozhdeniya', expect.objectContaining({ subject: 'Анна Петровна, с днём рождения!' }));
    expect(sends.rows).toHaveLength(1);
    expect(sends.rows[0]).toMatchObject({ year: 2026, status: GreetingSendStatus.SENT, template_title: template.title });
  });

  it('повторный запуск в тот же день второго письма не отправляет', async () => {
    const { sender, sends, notify } = build();
    await sender.run(9, BIRTHDAY_MORNING);
    await sender.run(9, new Date('2026-06-15T08:05:00Z'));
    expect(notify).toHaveBeenCalledTimes(1);
    expect(sends.rows).toHaveLength(1);
  });

  it('ошибку отправки повторяет следующим запуском и считает попытки', async () => {
    const notify = jest.fn().mockRejectedValueOnce(new Error('почта недоступна')).mockResolvedValue({ acknowledged: true, outboxIds: [] });
    const { sender, sends } = build({ notify });
    await sender.run(9, BIRTHDAY_MORNING);
    expect(sends.rows[0]).toMatchObject({ status: GreetingSendStatus.FAILED, error: 'почта недоступна', attempts: 1 });
    await sender.run(9, new Date('2026-06-15T08:05:00Z'));
    expect(sends.rows).toHaveLength(1);
    expect(sends.rows[0]).toMatchObject({ status: GreetingSendStatus.SENT, attempts: 2, error: null });
  });

  it('до часа отправки ничего не делает', async () => {
    const { sender, notify } = build();
    // 08:00 по Москве при часе отправки 9.
    expect(await sender.run(9, new Date('2026-06-15T05:00:00Z'))).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  });

  it('без действующего шаблона пропускает с причиной', async () => {
    const { sender, sends, notify, templates } = build();
    templates.forDate.mockResolvedValue(null);
    await sender.run(9, BIRTHDAY_MORNING);
    expect(notify).not.toHaveBeenCalled();
    expect(sends.rows[0]).toMatchObject({ status: GreetingSendStatus.SKIPPED, reason: GreetingSkipReason.NO_TEMPLATE });
  });

  it('пайщика, который не действующий, не поздравляет', async () => {
    const { sender, sends, notify } = build({ status: MonoAccountStatus.Blocked });
    await sender.run(9, BIRTHDAY_MORNING);
    expect(notify).not.toHaveBeenCalled();
    expect(sends.rows[0]).toMatchObject({ status: GreetingSendStatus.SKIPPED, reason: GreetingSkipReason.NOT_ACTIVE });
  });

  it('пайщика без почты пропускает с причиной', async () => {
    const { sender, sends, notify } = build({ email: '' });
    await sender.run(9, BIRTHDAY_MORNING);
    expect(notify).not.toHaveBeenCalled();
    expect(sends.rows[0]).toMatchObject({ status: GreetingSendStatus.SKIPPED, reason: GreetingSkipReason.NO_RECIPIENT });
  });
});
