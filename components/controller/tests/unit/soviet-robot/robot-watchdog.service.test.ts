/**
 * Сторож робота совета: одно решение — один проход за раз. События голосов
 * приходят пачкой, и параллельные проходы по одной записи подали бы второй
 * голос или второй протокол; замок сводит их к текущему проходу плюс одному
 * добавочному, а проход берёт свежую запись из журнала.
 */
import { RobotWatchdogService } from '~/extensions/soviet-robot/application/services/robot-watchdog.service';
import { RobotDecisionStage } from '~/extensions/soviet-robot/domain/enums/robot-decision-stage.enum';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

function makeLogger() {
  return { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeEntry(decision_id = 7) {
  return {
    id: `j${decision_id}`,
    coopname: 'voskhod',
    decision_id,
    decision_type: 'freedecision',
    decision_hash: 'AB'.repeat(32),
    username: 'ant',
    stage: RobotDecisionStage.NEW,
    votes: [],
    waiting_for: [],
    protocol_hash: null,
    tx_hashes: [],
    last_error: null,
    attempts: 0,
    next_attempt_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as any;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function build(processMs = 30) {
  const stored = makeEntry();
  const journal = {
    findByDecision: jest.fn(async () => stored),
    save: jest.fn(async (e: any) => e),
    findDue: jest.fn(async () => []),
  } as any;
  const extensions = { findByName: jest.fn(async () => ({ enabled: true, config: {} })) } as any;
  const decisions = {
    process: jest.fn(async (e: any) => {
      await delay(processMs);
      return e;
    }),
  } as any;
  const service = new RobotWatchdogService(journal, extensions, decisions, makeLogger());
  return { service, journal, decisions, stored };
}

describe('RobotWatchdogService.processLocked', () => {
  it('три события по одному решению разом — текущий проход и один добавочный, не три', async () => {
    const { service, decisions } = build();
    const entry = makeEntry();
    await Promise.all([service.processNow(entry), service.processNow(entry), service.processNow(entry)]);
    expect(decisions.process).toHaveBeenCalledTimes(2);
  });

  it('проход берёт свежую запись из журнала, а не ту, что пришла с событием', async () => {
    const { service, decisions, stored } = build();
    stored.stage = RobotDecisionStage.AWAITING_QUORUM;
    await service.processNow(makeEntry());
    expect(decisions.process.mock.calls[0][0].stage).toBe(RobotDecisionStage.AWAITING_QUORUM);
  });

  it('разные решения обрабатываются независимо', async () => {
    const { service, decisions } = build();
    await Promise.all([service.processNow(makeEntry(1)), service.processNow(makeEntry(2))]);
    expect(decisions.process).toHaveBeenCalledTimes(2);
  });

  it('после завершения прохода следующее событие запускает новый проход', async () => {
    const { service, decisions } = build(5);
    await service.processNow(makeEntry());
    await service.processNow(makeEntry());
    expect(decisions.process).toHaveBeenCalledTimes(2);
  });

  it('ошибка прохода не запирает решение: добавочный проход всё равно идёт', async () => {
    const { service, decisions } = build();
    decisions.process.mockImplementationOnce(async () => {
      await delay(10);
      throw new Error('цепь не ответила');
    });
    const entry = makeEntry();
    const results = await Promise.allSettled([service.processNow(entry), service.processNow(entry)]);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(decisions.process).toHaveBeenCalledTimes(2);
  });
});
