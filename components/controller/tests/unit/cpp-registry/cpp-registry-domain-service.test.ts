/**
 * Unit-тесты CppRegistryDomainService.register (Story 1.2).
 *
 * AC: «при повторной установке запись не дублируется (upsert)».
 *
 * Покрываем:
 *   (a) первый вызов register → upsertByExtension вызван с теми же данными;
 *   (b) повторный вызов register (имитация re-install) → upsertByExtension
 *       вызван второй раз с тем же `required_for_extension` (репозиторий
 *       обновит существующую запись, не создаст новую — идемпотентность);
 *   (c) логирование информации о записи.
 */

import { CppRegistryDomainService } from '~/domain/cpp-registry/services/cpp-registry-domain.service';
import { CppRegistryEntryDomainEntity } from '~/domain/cpp-registry/entities/cpp-registry-entry.entity';

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

const makeRepo = () =>
  ({
    upsertByExtension: jest.fn().mockImplementation(async (entry: CppRegistryEntryDomainEntity) => entry),
    findByExtension: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    deleteByExtension: jest.fn(),
  } as any);

describe('CppRegistryDomainService.register', () => {
  const input = {
    template_document_registry_id: 996,
    required_for_extension: 'market',
    mvp_hardcoded: true,
  };

  it('вызывает upsertByExtension с переданными данными и логирует upsert', async () => {
    const repo = makeRepo();
    const logger = makeLogger();
    const service = new CppRegistryDomainService(repo, logger);

    const saved = await service.register(input);

    expect(repo.upsertByExtension).toHaveBeenCalledTimes(1);
    const calledWith: CppRegistryEntryDomainEntity = repo.upsertByExtension.mock.calls[0][0];
    expect(calledWith.template_document_registry_id).toBe(996);
    expect(calledWith.required_for_extension).toBe('market');
    expect(calledWith.mvp_hardcoded).toBe(true);

    expect(saved.required_for_extension).toBe('market');
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[CPP_REGISTRY] upsert market → template_document_registry_id=996')
    );
  });

  it('повторный register с тем же extension вызывает upsertByExtension снова (идемпотентно — repo обновит, не задублирует)', async () => {
    const repo = makeRepo();
    const service = new CppRegistryDomainService(repo, makeLogger());

    await service.register(input);
    await service.register({ ...input, template_document_registry_id: 1000 });

    expect(repo.upsertByExtension).toHaveBeenCalledTimes(2);
    const firstCall: CppRegistryEntryDomainEntity = repo.upsertByExtension.mock.calls[0][0];
    const secondCall: CppRegistryEntryDomainEntity = repo.upsertByExtension.mock.calls[1][0];
    expect(firstCall.required_for_extension).toBe(secondCall.required_for_extension);
    expect(firstCall.template_document_registry_id).toBe(996);
    expect(secondCall.template_document_registry_id).toBe(1000);
  });
});
