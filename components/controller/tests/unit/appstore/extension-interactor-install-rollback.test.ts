/**
 * Unit-тесты ExtensionInteractor.installApp atomic rollback (Story 1.1).
 *
 * AC «при провале установки — статус «Ошибка», логи backend содержат
 * подробности, процессы и БД-таблицы откатываются».
 *
 * Покрытие:
 *   (a) runApp бросил, записи в БД не было до install → uninstallApp вызван;
 *   (b) runApp бросил, запись уже существовала → uninstallApp НЕ вызван
 *       (rollback ограничивается пробросом исключения, чтобы не снести
 *       чужую установку);
 *   (c) runApp прошёл → uninstallApp НЕ вызван, возвращается app.
 *
 * Прямой import `ExtensionInteractor` тянет через
 * `ExtensionLifecycleDomainService → extensions.registry → capital-extension`
 * и упирается в ESM `@octokit/rest` (та же причина, что и в
 * `capital-extension-register.test.ts` — комментарий «Тест чистой функции — не
 * тянет за собой импорт CapitalExtension»). Mock'аем lifecycle-service на пустышку
 * — interactor использует его только как тип конструктора + два метода
 * (`runApp`, `terminateApp`), которые мы передаём явно.
 */

jest.mock('~/domain/extension/services/extension-lifecycle-domain.service', () => ({
  ExtensionLifecycleDomainService: class {},
}));

import { ExtensionInteractor } from '~/application/appstore/interactors/extension.interactor';

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

describe('ExtensionInteractor.installApp atomic rollback', () => {
  it('rollback-ит uninstall если runApp провалился и записи не было до install', async () => {
    const installed = { name: 'market', enabled: true, config: {} };
    const extensionDomainService = {
      getAppByName: jest.fn().mockResolvedValue(null),
      installApp: jest.fn().mockResolvedValue(installed),
      uninstallApp: jest.fn().mockResolvedValue(true),
    } as any;
    const appLifecycleService = {
      runApp: jest.fn().mockRejectedValue(new Error('init failed')),
      terminateApp: jest.fn().mockResolvedValue(undefined),
    } as any;
    const logger = makeLogger();
    const interactor = new ExtensionInteractor(extensionDomainService, appLifecycleService, logger);

    await expect(
      interactor.installApp({ name: 'market', enabled: true } as any)
    ).rejects.toThrow('init failed');

    expect(extensionDomainService.uninstallApp).toHaveBeenCalledWith({ name: 'market' });
    expect(logger.error).toHaveBeenCalled();
  });

  it('НЕ удаляет если запись существовала до install (rollback = только throw)', async () => {
    const preExisting = { name: 'market', enabled: true, config: {} };
    const extensionDomainService = {
      getAppByName: jest.fn().mockResolvedValue(preExisting),
      installApp: jest.fn().mockResolvedValue(preExisting),
      uninstallApp: jest.fn().mockResolvedValue(true),
    } as any;
    const appLifecycleService = {
      runApp: jest.fn().mockRejectedValue(new Error('init failed')),
      terminateApp: jest.fn().mockResolvedValue(undefined),
    } as any;
    const logger = makeLogger();
    const interactor = new ExtensionInteractor(extensionDomainService, appLifecycleService, logger);

    await expect(
      interactor.installApp({ name: 'market', enabled: true } as any)
    ).rejects.toThrow('init failed');

    expect(extensionDomainService.uninstallApp).not.toHaveBeenCalled();
  });

  it('возвращает app при успешном runApp', async () => {
    const installed = { name: 'market', enabled: true, config: {} };
    const extensionDomainService = {
      getAppByName: jest.fn().mockResolvedValue(null),
      installApp: jest.fn().mockResolvedValue(installed),
      uninstallApp: jest.fn(),
    } as any;
    const appLifecycleService = {
      runApp: jest.fn().mockResolvedValue(undefined),
      terminateApp: jest.fn().mockResolvedValue(undefined),
    } as any;
    const logger = makeLogger();
    const interactor = new ExtensionInteractor(extensionDomainService, appLifecycleService, logger);

    const result = await interactor.installApp({ name: 'market', enabled: true } as any);

    expect(result).toBe(installed);
    expect(appLifecycleService.runApp).toHaveBeenCalledWith('market');
    expect(extensionDomainService.uninstallApp).not.toHaveBeenCalled();
  });
});
