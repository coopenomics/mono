import { MonoAccountStatus } from '@coopenomics/innercoop';
import { GreetingsMailingService } from '~/extensions/greetings/application/services/greetings-mailing.service';
import { toGreetingPerson } from '~/extensions/greetings/application/services/greetings-people.service';
import { GreetingSendStatus, GreetingTemplateKind, GreetingTemplateStatus } from '~/extensions/greetings/domain/greetings.enums';
import type { GreetingSendRecord, GreetingTemplateRecord } from '~/extensions/greetings/infrastructure/database/greetings.records';

/**
 * Информационная рассылка в дату: письмо каждому действующему пайщику с
 * почтой, одно на шаблон, пайщика и дату. Повторный запуск в тот же день не
 * шлёт письмо второй раз; обход без ошибок ставит шаблону отметку дня.
 */

const matches = (row: object, where: object) => Object.entries(where).every(([key, value]) => (row as any)[key] === value);

function memoryStore<T extends { id: string }>() {
  const rows: T[] = [];
  let seq = 0;
  return {
    rows,
    async findOne(where: Partial<T>) {
      return rows.find((row) => matches(row, where)) ?? null;
    },
    async save(record: Partial<T>) {
      const existing = record.id ? rows.find((row) => row.id === record.id) : undefined;
      if (existing) return Object.assign(existing, record);
      const row = { ...record, id: `row-${++seq}` } as T;
      rows.push(row);
      return row;
    },
    async update(where: Partial<T>, patch: Partial<T>) {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, patch));
      return hit.length;
    },
  };
}

function account(username: string, status: MonoAccountStatus, email: string, org = false) {
  return {
    username,
    provider_account: { status, is_registered: true, email, subscriber_id: email ? `sub-${username}` : '' },
    private_account: org
      ? { type: 'organization', organization_data: { short_name: 'ООО «Ромашка»' } }
      : { type: 'individual', individual_data: { first_name: 'Анна', middle_name: 'Петровна', last_name: 'Иванова' } },
  } as never;
}

const notice = {
  id: 'tpl-notice',
  title: 'Собрание пайщиков',
  kind: GreetingTemplateKind.MAILING,
  status: GreetingTemplateStatus.ACTIVE,
  repeat_yearly: false,
  sent_on: null,
  period_start: '2026-06-15',
  period_end: '2026-06-15',
  subject: '{{Обращение}}, приглашаем на собрание',
  body: '{{Кооператив}} приглашает вас.',
} as unknown as GreetingTemplateRecord;

const TODAY = { year: 2026, month: 6, day: 15 };

function build(
  notify: jest.Mock = jest.fn(async (username: string) => ({ acknowledged: true, outboxIds: [`${username}-email`, `${username}-inapp`] }))
) {
  const templates = memoryStore<GreetingTemplateRecord>();
  templates.rows.push({ ...notice });
  const sends = memoryStore<GreetingSendRecord>();
  const accounts = [
    account('anna', MonoAccountStatus.Active, 'anna@example.com'),
    account('romashka', MonoAccountStatus.Active, 'org@example.com', true),
    account('blocked', MonoAccountStatus.Blocked, 'b@example.com'),
    account('nomail', MonoAccountStatus.Active, ''),
  ];
  const people = {
    page: jest.fn().mockResolvedValue({ people: accounts.map(toGreetingPerson), totalPages: 1 }),
    signature: jest.fn().mockResolvedValue({ cooperative: 'ПК «Восход»', chairman: 'Петров Пётр Петрович' }),
    displayName: jest.fn(async (username: string) => (username === 'romashka' ? 'ООО «Ромашка»' : 'Иванова Анна Петровна')),
    subject: (person: any, age: number | null, signature: any) => ({
      lastName: person.lastName,
      firstName: person.firstName,
      middleName: person.middleName,
      age,
      ...signature,
    }),
  };
  const logger = { setContext: jest.fn(), info: jest.fn(), error: jest.fn() };
  const service = new GreetingsMailingService(
    templates as never,
    sends as never,
    people as never,
    { notifyUser: notify } as never,
    logger as never
  );
  return { service, templates, sends, notify };
}

describe('поздравления: рассылка в дату', () => {
  it('отправляет письмо действующим пайщикам с почтой, организации — по названию', async () => {
    const { service, sends, notify } = build();
    const [result] = await service.run(TODAY, [notice]);
    expect(result).toMatchObject({ sent: 2, failed: 0 });
    expect(notify.mock.calls.map((call) => call[0])).toEqual(['anna', 'romashka']);
    expect(notify.mock.calls[0][1]).toBe('informatsionnaya-rassylka');
    expect(notify.mock.calls[1][2].subject).toBe('ООО «Ромашка», приглашаем на собрание');
    expect(notify.mock.calls[0][2].occasion).toBe('mailing:tpl-notice:2026-06-15');
    expect(sends.rows.every((row) => row.kind === GreetingTemplateKind.MAILING && row.occasion_date === '2026-06-15')).toBe(true);
    // Строки очереди сохраняются: по ним календарь и журнал читают доставку.
    expect(sends.rows.find((row) => row.username === 'anna')?.outbox_ids).toEqual(['anna-email', 'anna-inapp']);
  });

  it('после обхода без ошибок ставит отметку дня и в тот же день пайщиков не перебирает', async () => {
    const { service, templates, notify } = build();
    await service.run(TODAY, [notice]);
    expect(templates.rows[0].sent_on).toBe('2026-06-15');
    await service.run(TODAY, [templates.rows[0]]);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('после ошибки повторяет только неотправленные письма', async () => {
    const notify = jest
      .fn()
      .mockResolvedValueOnce({ acknowledged: true, outboxIds: [] })
      .mockRejectedValueOnce(new Error('почта недоступна'))
      .mockResolvedValue({ acknowledged: true, outboxIds: [] });
    const { service, templates, sends } = build(notify);
    const [first] = await service.run(TODAY, [notice]);
    expect(first).toMatchObject({ sent: 1, failed: 1 });
    expect(templates.rows[0].sent_on).toBeNull();
    await service.run(TODAY, [templates.rows[0]]);
    expect(notify).toHaveBeenCalledTimes(3);
    expect(sends.rows).toHaveLength(2);
    expect(sends.rows.every((row) => row.status === GreetingSendStatus.SENT)).toBe(true);
  });

  it('в другую дату разовую рассылку не отправляет', async () => {
    const { service, notify } = build();
    expect(await service.run({ year: 2026, month: 6, day: 16 }, [notice])).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });
});
