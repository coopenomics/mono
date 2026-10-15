/**
 * Unit-тесты MarketplaceExtension.initialize (Story 1.1).
 *
 * Покрывают AC-логи:
 *   (a) file-storage порт не подключён → warn-лог про PR #359, остальные шаги
 *       выполняются, итоговый «marketplace-extension готов» в логе есть;
 *   (b) file-storage порт подключён → ensureBucket(`coop-<coopname>`) вызван,
 *       три AC-лога: «Создан физический бакет ...», «File storage готов»,
 *       «marketplace-extension готов»;
 *   (c) в БД нет записи `market` → initialize бросает «Конфиг не найден».
 */

import { MarketplaceExtension } from '~/extensions/marketplace/marketplace-extension.module';

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

/** Реестр шаблонов кооператива: расширение объявляет в него свои документы при старте. */
const makeDocumentsPort = () =>
  ({
    registerDocuments: jest.fn().mockResolvedValue(undefined),
    unregisterByExtension: jest.fn().mockResolvedValue(undefined),
  } as any);

/**
 * Расширение при старте открывает свою программу ЦПП в цепи. По умолчанию мок
 * отвечает «программа уже открыта» — тестам этого сьюта важны только логи
 * initialize, а не сама транзакция.
 */
const makeSovietPort = (result: any = { created: false, program_id: 2 }) =>
  ({
    ensureProgram: jest.fn().mockResolvedValue(result),
  } as any);

/** Утверждения документов в цепи: по умолчанию совет ещё ничего не утвердил. */
const makeApprovalsPort = (approved: string[] = []) =>
  ({
    isStepApproved: jest.fn(async (_extension: string, step: string) => approved.includes(step)),
    proposeOnboardingStep: jest.fn(),
  } as any);

/** Репозиторий, который помнит дописанные настройки — как настоящий patchConfig. */
const makeStatefulRepo = (config: Record<string, unknown>) => {
  const record = { name: 'market', config: { ...config }, enabled: true } as any;
  return {
    findByName: jest.fn(async () => record),
    patchConfig: jest.fn(async (_name: string, patch: Record<string, unknown>) => {
      Object.assign(record.config, patch);
      return record;
    }),
  } as any;
};

const L1_DONE = {
  onboarding_marketplace_provision_done: true,
  onboarding_marketplace_offer_template_done: true,
};

describe('MarketplaceExtension.initialize: программа во вступлении', () => {
  it('совет документы ЦПП не утвердил — программа вступающим не предлагается', async () => {
    const agreements = makeAgreementPort();
    const extension = new MarketplaceExtension(makeStatefulRepo({}), makeLogger(), agreements, makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), makeApprovalsPort(), null);

    await extension.initialize();

    expect(agreements.registerProgram).not.toHaveBeenCalled();
    expect(agreements.registerAgreement).not.toHaveBeenCalled();
  });

  it('утверждён только один из двух документов — программа не предлагается', async () => {
    const agreements = makeAgreementPort();
    const repo = makeStatefulRepo({ onboarding_marketplace_provision_done: true });
    const extension = new MarketplaceExtension(repo, makeLogger(), agreements, makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), makeApprovalsPort(), null);

    await extension.initialize();

    expect(agreements.registerProgram).not.toHaveBeenCalled();
  });

  it('оба шага отмечены — программа регистрируется', async () => {
    const agreements = makeAgreementPort();
    const extension = new MarketplaceExtension(makeStatefulRepo(L1_DONE), makeLogger(), agreements, makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), makeApprovalsPort(), null);

    await extension.initialize();

    expect(agreements.registerProgram).toHaveBeenCalledWith(expect.objectContaining({ key: 'MARKETPLACE' }));
  });

  // Решение совета прошло мимо приёмника (контроллер не работал, документ
  // утвердили со вкладки «Шаблоны документов»): отметок нет, утверждение в цепи есть.
  it('отметок нет, но документы утверждены в цепи — отметки дописываются, программа регистрируется', async () => {
    const agreements = makeAgreementPort();
    const repo = makeStatefulRepo({});
    const approvals = makeApprovalsPort(['marketplace_provision', 'marketplace_offer_template']);
    const extension = new MarketplaceExtension(repo, makeLogger(), agreements, makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), approvals, null);

    await extension.initialize();

    expect(repo.patchConfig).toHaveBeenCalledWith('market', L1_DONE);
    expect(agreements.registerProgram).toHaveBeenCalledWith(expect.objectContaining({ key: 'MARKETPLACE' }));
  });

  it('цепь недоступна при сверке — расширение поднимается, программа не предлагается', async () => {
    const agreements = makeAgreementPort();
    const approvals = { isStepApproved: jest.fn().mockRejectedValue(new Error('chain down')) } as any;
    const logger = makeLogger();
    const extension = new MarketplaceExtension(makeStatefulRepo({}), logger, agreements, makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), approvals, null);

    await extension.initialize();

    expect(logger.info).toHaveBeenCalledWith('marketplace-extension готов');
    expect(agreements.registerProgram).not.toHaveBeenCalled();
  });
});

describe('MarketplaceExtension.initialize', () => {
  it('пишет info о fallback и продолжает install, если file-storage не подключён', async () => {
    const logger = makeLogger();
    const repo = makeRepo();
    const extension = new MarketplaceExtension(repo, logger, makeAgreementPort(), makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), makeApprovalsPort(), null);

    await extension.initialize();

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
    const extension = new MarketplaceExtension(repo, logger, makeAgreementPort(), makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), makeApprovalsPort(), fileStorage);

    await extension.initialize();

    expect(fileStorage.ensureBucket).toHaveBeenCalledTimes(1);
    expect(fileStorage.ensureBucket.mock.calls[0][0]).toMatch(/^coop-/);
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Создан физический бакет 'coop-/));
    expect(logger.info).toHaveBeenCalledWith('File storage готов');
    expect(logger.info).toHaveBeenCalledWith('marketplace-extension готов');
  });

  it('бросает «Конфиг не найден» если в БД нет записи market', async () => {
    const logger = makeLogger();
    const repo = makeRepo(null);
    const extension = new MarketplaceExtension(repo, logger, makeAgreementPort(), makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), makeApprovalsPort(), null);

    await expect(extension.initialize()).rejects.toThrow('Конфиг не найден');
  });

  it('расширение зарегистрировано под именем `market` (совпадает с ключом AppRegistry)', () => {
    const extension = new MarketplaceExtension(makeRepo(), makeLogger(), makeAgreementPort(), makeOnboardingPort(), makeDocumentsPort(), makeSovietPort(), makeApprovalsPort(), null);
    expect(extension.name).toBe('market');
  });
});
