/** Outbox выдачи доступа: дедуп, backoff, needs_attention, сверка курса, exists=успех, смена контакта. */
import { backoffMinutes, EdubridgeAccessOutboxService, OUTBOX_MAX_ATTEMPTS } from '~/extensions/edubridge/application/services/edubridge-access-outbox.service';
import { EduAccessCarrier, EduAccessState, EduAccessTaskKind, EduAccessTaskStatus } from '~/extensions/edubridge/domain/enums';
import { EDUBRIDGE_ACCESS_GRANTED_EVENT, EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT } from '~/extensions/edubridge/application/events/edubridge.events';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

function make(opts: { grant?: any; check?: any; task?: Partial<any>; checkedAt?: Date | null } = {}) {
  const task = {
    id: 'T1', coopname: 'voskhod', enrollment_id: 'E1', kind: EduAccessTaskKind.GRANT, carrier: EduAccessCarrier.SKILLSPACE,
    trigger_trx: 'TRX', status: EduAccessTaskStatus.RUNNING, attempts: 0, next_attempt_at: new Date(), recipient_override: null, ...opts.task,
  } as any;
  const enrollment = { id: 'E1', coopname: 'voskhod', learner_id: 'L1', course_id: 'C1', member_username: 'ant', access_state: EduAccessState.PENDING } as any;
  const course = { id: 'C1', carrier: EduAccessCarrier.SKILLSPACE, external_ref: 'course-42', external_title_seen: 'Алгебра', external_checked_at: opts.checkedAt ?? null } as any;
  const learner = { id: 'L1', recipient_type: 'email', recipient_value: 'kid@x.ru' } as any;
  const tasks = { enqueue: jest.fn(async (d: any) => ({ ...d })), claimDue: jest.fn(async () => [task]), save: jest.fn(async (t: any) => t), findById: jest.fn(async () => task) } as any;
  const enrollments = { findById: jest.fn(async () => enrollment), save: jest.fn(async (e: any) => e) } as any;
  const learners = { findById: jest.fn(async () => learner) } as any;
  const courses = { findById: jest.fn(async () => course), save: jest.fn(async (c: any) => c) } as any;
  const bindings = { touch: jest.fn(), setHealth: jest.fn() } as any;
  const connector = {
    carrier: EduAccessCarrier.SKILLSPACE,
    grant: jest.fn(async (_r: any) => opts.grant ?? { code: 'ok' }),
    revoke: jest.fn(async (_r: any) => ({ code: 'ok' })),
    check: jest.fn(async (_c: string, _ref: string) => opts.check ?? { found: true, title: 'Алгебра' }),
  };
  const connectors = { get: jest.fn(() => connector) } as any;
  const events = { emit: jest.fn() } as any;
  const service = new EdubridgeAccessOutboxService(tasks, enrollments, learners, courses, bindings, connectors, logger, events);
  return { service, task, enrollment, tasks, connector, events, bindings };
}

describe('backoffMinutes', () => {
  it('1, 2, 4, 8 … и не больше 60', () => {
    expect([1, 2, 3, 4, 7, 10].map(backoffMinutes)).toEqual([1, 2, 4, 8, 60, 60]);
  });
});

describe('EdubridgeAccessOutboxService.processDue', () => {
  it('успех: задача done, доступ GRANTED, событие granted, площадке ушёл только контакт', async () => {
    const { service, task, enrollment, connector, events } = make();
    await service.processDue('voskhod');
    expect(task.status).toBe(EduAccessTaskStatus.DONE);
    expect(enrollment.access_state).toBe(EduAccessState.GRANTED);
    const req = connector.grant.mock.calls[0]![0] as any;
    expect(req.recipient).toEqual({ type: 'email', value: 'kid@x.ru' });
    expect(Object.keys(req.recipient)).not.toContain('display_name');
    expect(events.emit).toHaveBeenCalledWith(EDUBRIDGE_ACCESS_GRANTED_EVENT, expect.anything());
  });

  it('«пользователь уже существует» — это успех', async () => {
    const { service, task } = make({ grant: { code: 'exists' } });
    await service.processDue('voskhod');
    expect(task.status).toBe(EduAccessTaskStatus.DONE);
    expect(task.last_result).toBe('exists');
  });

  it('retryable: остаётся pending с backoff, счётчик растёт', async () => {
    const { service, task } = make({ grant: { code: 'retryable', message: 'timeout' } });
    const before = Date.now();
    await service.processDue('voskhod');
    expect(task.status).toBe(EduAccessTaskStatus.PENDING);
    expect(task.attempts).toBe(1);
    expect(task.next_attempt_at.getTime()).toBeGreaterThanOrEqual(before + 60_000 - 5);
  });

  it('N-я неудача → needs_attention, доступ NEEDS_ATTENTION, событие владельцу', async () => {
    const { service, task, enrollment, events } = make({ grant: { code: 'retryable', message: 'down' }, task: { attempts: OUTBOX_MAX_ATTEMPTS - 1 } });
    await service.processDue('voskhod');
    expect(task.status).toBe(EduAccessTaskStatus.NEEDS_ATTENTION);
    expect(enrollment.access_state).toBe(EduAccessState.NEEDS_ATTENTION);
    expect(events.emit).toHaveBeenCalledWith(EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT, expect.anything());
  });

  it('fatal с LICENSE_LIMIT — сразу needs_attention и здоровье площадки', async () => {
    const { service, task, bindings } = make({ grant: { code: 'fatal', message: 'limit', error_code: 'LICENSE_LIMIT' } });
    await service.processDue('voskhod');
    expect(task.status).toBe(EduAccessTaskStatus.NEEDS_ATTENTION);
    expect(bindings.setHealth).toHaveBeenCalledWith('voskhod', EduAccessCarrier.SKILLSPACE, 'license_limit', expect.any(String));
  });

  it('курс на площадке переименован — выдача не делается, needs_attention', async () => {
    const { service, task, connector } = make({ check: { found: true, title: 'Геометрия' } });
    await service.processDue('voskhod');
    expect(connector.grant).not.toHaveBeenCalled();
    expect(task.status).toBe(EduAccessTaskStatus.NEEDS_ATTENTION);
    expect(task.last_error).toMatch(/переименован/);
  });

  it('недавно сверенный курс повторно не проверяется — экспорт-API лимитирован', async () => {
    const { service, connector, task } = make({ checkedAt: new Date() });
    await service.processDue('voskhod');
    expect(connector.check).not.toHaveBeenCalled();
    expect(task.status).toBe(EduAccessTaskStatus.DONE);
  });

  it('площадка недоступна при сверке — retryable, не needs_attention', async () => {
    const { service, task } = make({ check: { found: false, unavailable: true } });
    await service.processDue('voskhod');
    expect(task.status).toBe(EduAccessTaskStatus.PENDING);
  });

  it('отзыв старого адреса при смене контакта не меняет состояние доступа', async () => {
    const { service, enrollment, connector } = make({ task: { kind: EduAccessTaskKind.REVOKE, recipient_override: { type: 'email', value: 'old@x.ru' } } });
    await service.processDue('voskhod');
    expect((connector.revoke.mock.calls[0]![0] as any).recipient.value).toBe('old@x.ru');
    expect(enrollment.access_state).toBe(EduAccessState.PENDING);
  });
});
