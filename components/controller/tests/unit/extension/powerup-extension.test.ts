import { PowerupExtension, defaultConfig, type IConfig, type ILog } from '../../../src/extensions/powerup/powerup-extension.module';

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({
    coopname: 'voskhod',
    blockchain: { rootSymbol: 'AXON', rootPrecision: 4 },
  }),
}));

/**
 * Журнал аренды ведётся по факту пополнения.
 *
 * До 18.09.2026 отказ транзакции проглатывался уровнем `info`, и запись в журнал
 * ложилась на каждую попытку: за двое суток инцидента «overdrawn balance» там
 * накопились сотни «немедленных пополнений», которых не было. Проверка ресурсов
 * идёт раз в минуту, поэтому вторая обязанность — не повторять безнадёжную
 * попытку каждую минуту.
 */

/** Аккаунт с использованием ресурсов выше порога — повод пополнить. */
function accountOverThreshold(overrides: Record<string, any> = {}) {
  return {
    account_name: 'voskhod',
    ram_usage: 292_000,
    ram_quota: 313_000,
    cpu_limit: { used: '0', available: '0', max: '100' },
    net_limit: { used: '0', available: '0', max: '100' },
    ...overrides,
  };
}

/** Аккаунт, которому пополнение не нужно. */
function accountBelowThreshold() {
  return accountOverThreshold({ ram_usage: 10_000, ram_quota: 1_000_000 });
}

function buildExtension(account: Record<string, any> | null) {
  const logs: ILog[] = [];
  const config: IConfig = { ...defaultConfig, lastDailyReplenishmentDate: '' } as IConfig;

  const extensionRepository = {
    findByName: jest.fn().mockResolvedValue({ name: 'powerup', config }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const logExtensionRepository = {
    push: jest.fn(async (_name: string, action: ILog) => {
      logs.push(action);
    }),
  };
  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
  const blockchainPort = {
    getAccount: jest.fn().mockResolvedValue(account),
    powerUp: jest.fn().mockResolvedValue('trx-1'),
  };

  const extension = new PowerupExtension(
    extensionRepository as never,
    logExtensionRepository as never,
    logger as never,
    blockchainPort as never
  );
  (extension as unknown as { extension: unknown }).extension = { name: 'powerup', config };

  return { extension, blockchainPort, logger, logs, extensionRepository };
}

function runTask(extension: PowerupExtension): Promise<void> {
  return (extension as unknown as { runTask: () => Promise<void> }).runTask();
}

function runDailyTask(extension: PowerupExtension): Promise<void> {
  return (extension as unknown as { runDailyTask: () => Promise<void> }).runDailyTask();
}

describe('PowerupExtension', () => {
  it('пишет в журнал аренды прошедшее пополнение вместе с транзакцией', async () => {
    const { extension, logs } = buildExtension(accountOverThreshold());

    await runTask(extension);

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'now', amount: '5.0000 AXON', trx_id: 'trx-1' });
  });

  it('не пишет в журнал пополнение, которое цепь отклонила', async () => {
    const { extension, blockchainPort, logs, logger } = buildExtension(accountOverThreshold());
    blockchainPort.powerUp.mockRejectedValue(new Error('assertion failure with message: overdrawn balance'));

    await runTask(extension);

    expect(logs).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('после отказа выдерживает паузу, а не повторяет каждую минуту', async () => {
    const { extension, blockchainPort, logger } = buildExtension(accountOverThreshold());
    blockchainPort.powerUp.mockRejectedValue(new Error('assertion failure with message: overdrawn balance'));

    await runTask(extension);
    await runTask(extension);
    await runTask(extension);

    expect(blockchainPort.powerUp).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('не пополняет, пока ресурсы ниже порога', async () => {
    const { extension, blockchainPort, logs } = buildExtension(accountBelowThreshold());

    await runTask(extension);

    expect(blockchainPort.powerUp).not.toHaveBeenCalled();
    expect(logs).toHaveLength(0);
  });

  it('дата ежедневного пополнения ставится только после принятой транзакции', async () => {
    const { extension, blockchainPort, extensionRepository, logs } = buildExtension(accountOverThreshold());
    blockchainPort.powerUp.mockRejectedValue(new Error('assertion failure with message: overdrawn balance'));

    await runDailyTask(extension);

    expect(extensionRepository.update).not.toHaveBeenCalled();
    expect(logs).toHaveLength(0);
  });

  it('удачное ежедневное пополнение отмечается датой и записью журнала', async () => {
    const { extension, extensionRepository, logs } = buildExtension(accountOverThreshold());

    await runDailyTask(extension);

    expect(extensionRepository.update).toHaveBeenCalledTimes(1);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'daily', trx_id: 'trx-1' });
  });
});
