/**
 * Unit-тесты MarketplacePlugin.initialize (Story 1.1).
 *
 * Покрывают AC-логи:
 *   (a) file-storage порт не подключён → warn-лог про PR #359, остальные шаги
 *       выполняются, итоговый «marketplace-extension готов» в логе есть;
 *   (b) file-storage порт подключён → ensureBucket(`coop-<coopname>`) вызван,
 *       три AC-лога: «Создан физический бакет ...», «File storage готов»,
 *       «marketplace-extension готов»;
 *   (c) в БД нет записи `market` → initialize бросает «Конфиг не найден».
 */

import { MarketplacePlugin } from '~/extensions/marketplace/marketplace-extension.module';

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

const makeRepo = (record: any = { name: 'market', config: {}, enabled: true }) =>
  ({
    findByName: jest.fn().mockResolvedValue(record),
  } as any);

const makeAgreementPort = () =>
  ({
    registerAgreement: jest.fn(),
    unregisterAgreement: jest.fn(),
    registerProgram: jest.fn(),
    unregisterProgram: jest.fn(),
  } as any);

const makeOnboardingPort = () =>
  ({
    registerStep: jest.fn(),
    unregisterStepsByExtension: jest.fn(),
  } as any);

describe('MarketplacePlugin.initialize', () => {
  it('пишет info о fallback и продолжает install, если file-storage не подключён', async () => {
    const logger = makeLogger();
    const repo = makeRepo();
    const plugin = new MarketplacePlugin(repo, logger, makeAgreementPort(), makeOnboardingPort(), null);

    await plugin.initialize();

    expect(logger.info).toHaveBeenCalledWith(
      'File storage отключён конфигурацией — пропускаем bucket init'
    );
    expect(logger.info).toHaveBeenCalledWith('marketplace-extension готов');
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Создан физический бакет')
    );
  });

  it('вызывает ensureBucket и пишет все три AC-лога когда file-storage подключён', async () => {
    const logger = makeLogger();
    const repo = makeRepo();
    const fileStorage = { ensureBucket: jest.fn().mockResolvedValue(undefined) };
    const plugin = new MarketplacePlugin(repo, logger, makeAgreementPort(), makeOnboardingPort(), fileStorage);

    await plugin.initialize();

    expect(fileStorage.ensureBucket).toHaveBeenCalledTimes(1);
    expect(fileStorage.ensureBucket.mock.calls[0][0]).toMatch(/^coop-/);
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Создан физический бакет 'coop-/));
    expect(logger.info).toHaveBeenCalledWith('File storage готов');
    expect(logger.info).toHaveBeenCalledWith('marketplace-extension готов');
  });

  it('бросает «Конфиг не найден» если в БД нет записи market', async () => {
    const logger = makeLogger();
    const repo = makeRepo(null);
    const plugin = new MarketplacePlugin(repo, logger, makeAgreementPort(), makeOnboardingPort(), null);

    await expect(plugin.initialize()).rejects.toThrow('Конфиг не найден');
  });

  it('расширение зарегистрировано под именем `market` (совпадает с ключом AppRegistry)', () => {
    const plugin = new MarketplacePlugin(makeRepo(), makeLogger(), makeAgreementPort(), makeOnboardingPort(), null);
    expect(plugin.name).toBe('market');
  });
});
