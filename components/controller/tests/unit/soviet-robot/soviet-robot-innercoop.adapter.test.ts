/**
 * Порт робота для Стола заказов: прямой вызов «реши сейчас». Проверяется
 * идемпотентность записи журнала, дожим проходов (голоса → протокол) и
 * перевод этапа робота в исход для инициатора.
 */
import { SovietRobotInnercoopAdapter } from '~/extensions/soviet-robot/application/adapters/soviet-robot-innercoop.adapter';
import { RobotDecisionStage } from '~/extensions/soviet-robot/domain/enums/robot-decision-stage.enum';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

const REQUEST = { coopname: 'voskhod', decision_id: 77, decision_type: 'mktissue', decision_hash: 'h-order-1', username: 'orderer1' };

function entryAt(stage: RobotDecisionStage, extra: Record<string, unknown> = {}) {
  return {
    id: 'j-1',
    coopname: 'voskhod',
    decision_id: 77,
    decision_type: 'mktissue',
    decision_hash: 'h-order-1',
    username: 'orderer1',
    stage,
    votes: [],
    waiting_for: [],
    protocol_hash: null,
    tx_hashes: [],
    last_error: null,
    attempts: 0,
    next_attempt_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...extra,
  } as any;
}

function build(opts: { enabled?: boolean; existing?: any; passes: any[] }) {
  const journal = {
    findByDecision: jest.fn(async () => opts.existing ?? null),
    createIfAbsent: jest.fn(async (data: any) => entryAt(RobotDecisionStage.NEW, data)),
  } as any;
  const queue = [...opts.passes];
  const watchdog = {
    isEnabled: jest.fn(async () => opts.enabled ?? true),
    processNow: jest.fn(async () => queue.shift() ?? queue[queue.length - 1]),
  } as any;
  const logger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
  return { adapter: new SovietRobotInnercoopAdapter(journal, watchdog, logger), journal, watchdog };
}

describe('Порт робота совета: requestDecision', () => {
  it('робот выключен — «manual», журнал не трогаем', async () => {
    const { adapter, journal, watchdog } = build({ enabled: false, passes: [] });
    await expect(adapter.requestDecision(REQUEST)).resolves.toEqual({ outcome: 'manual', detail: expect.stringContaining('не установлено') });
    expect(journal.createIfAbsent).not.toHaveBeenCalled();
    expect(watchdog.processNow).not.toHaveBeenCalled();
  });

  it('чужой кооператив — «failed» без обращения к журналу', async () => {
    const { adapter, journal } = build({ passes: [] });
    const res = await adapter.requestDecision({ ...REQUEST, coopname: 'other' });
    expect(res.outcome).toBe('failed');
    expect(journal.findByDecision).not.toHaveBeenCalled();
  });

  it('запись журнала уже есть (newsubmitted успел раньше) — вторая не создаётся', async () => {
    const existing = entryAt(RobotDecisionStage.NEW);
    const { adapter, journal, watchdog } = build({ existing, passes: [entryAt(RobotDecisionStage.EXECUTED, { tx_hashes: ['tx-1'] })] });
    const res = await adapter.requestDecision(REQUEST);
    expect(journal.createIfAbsent).not.toHaveBeenCalled();
    expect(watchdog.processNow).toHaveBeenCalledWith(existing);
    expect(res).toEqual({ outcome: 'authorized', tx_hash: 'tx-1', detail: undefined });
  });

  it('голоса ушли (VOTED) — дожимаем вторым проходом до протокола, не ждём тика сторожа', async () => {
    const { adapter, watchdog } = build({
      passes: [entryAt(RobotDecisionStage.VOTED), entryAt(RobotDecisionStage.EXECUTED, { tx_hashes: ['tx-votes', 'tx-protocol'] })],
    });
    const res = await adapter.requestDecision(REQUEST);
    expect(watchdog.processNow).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ outcome: 'authorized', tx_hash: 'tx-protocol', detail: undefined });
  });

  it('кворума робота нет — «pending» с именами, кого ждём; проходы не повторяются', async () => {
    const { adapter, watchdog } = build({ passes: [entryAt(RobotDecisionStage.AWAITING_FOLLOWED, { waiting_for: ['ant'] })] });
    const res = await adapter.requestDecision(REQUEST);
    expect(watchdog.processNow).toHaveBeenCalledTimes(1);
    expect(res.outcome).toBe('pending');
    expect(res.detail).toContain('ant');
  });

  it('председатель не делегировал протокол — «pending»', async () => {
    const { adapter } = build({ passes: [entryAt(RobotDecisionStage.AWAITING_CHAIRMAN)] });
    await expect(adapter.requestDecision(REQUEST)).resolves.toMatchObject({ outcome: 'pending' });
  });

  it('этап не двигается и есть ошибка — цикл останавливается, «pending» с причиной', async () => {
    const stuck = entryAt(RobotDecisionStage.VOTED, { last_error: 'nodeos unreachable' });
    const { adapter, watchdog } = build({ passes: [stuck, stuck, stuck, stuck] });
    const res = await adapter.requestDecision(REQUEST);
    expect(watchdog.processNow).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ outcome: 'pending', detail: 'nodeos unreachable' });
  });

  it('попытки исчерпаны — «failed»', async () => {
    const { adapter } = build({ passes: [entryAt(RobotDecisionStage.FAILED, { last_error: 'ключ отозван' })] });
    await expect(adapter.requestDecision(REQUEST)).resolves.toMatchObject({ outcome: 'failed', detail: 'ключ отозван' });
  });
});
