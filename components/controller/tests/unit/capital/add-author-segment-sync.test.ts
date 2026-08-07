/**
 * Unit-тесты синхронизации доли соавтора при его добавлении.
 *
 * Что здесь защищается. Добавление соавтора заводит участнику долю в проекте,
 * но обновление самого проекта её не приносит: это разные записи. Пока долю не
 * прочитали из цепи явно, она попадала в базу только очередным сообщением от
 * парсера — и список участников какое-то время оставался без нового соавтора.
 * Тесты фиксируют, что доля читается сразу и что неудача этого чтения не
 * отменяет уже совершённое добавление.
 *
 * Реестр случаев: test-registry/capital.project-contributors.yaml
 */

import { ProjectManagementInteractor } from '~/extensions/capital/application/use-cases/project-management.interactor';
import { ProjectOrigin } from '~/extensions/capital/domain/enums/project-origin.enum';

function makeLoggerStub() {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

function makeInteractor(o: { syncedSegment?: any; syncSegmentThrows?: Error } = {}) {
  const project = { project_hash: 'ph', origin: ProjectOrigin.BLOCKCHAIN };

  const capitalBlockchainPort = {
    addAuthor: jest.fn(async () => ({ transaction: { ref_block_num: 42 } })),
  } as any;

  const projectRepository = {
    findByHash: jest.fn(async () => project),
  } as any;

  const projectSyncService = {
    syncProject: jest.fn(async () => ({ project_hash: 'ph', isComponent: () => true })),
  } as any;

  const segmentSyncService = {
    syncSegment: jest.fn(async () => {
      if (o.syncSegmentThrows) throw o.syncSegmentThrows;
      return 'syncedSegment' in o ? o.syncedSegment : { username: 'ivan' };
    }),
  } as any;

  const interactor = new ProjectManagementInteractor(
    capitalBlockchainPort,
    projectRepository,
    makeLoggerStub(),
    projectSyncService,
    segmentSyncService,
    {} as any
  );

  return { interactor, capitalBlockchainPort, projectSyncService, segmentSyncService };
}

const addAuthorInput = {
  coopname: 'voskhod',
  project_hash: 'ph',
  author: 'ivan',
};

describe('capital: добавление соавтора синхронизирует его долю', () => {
  // cap.contrib.happy.04
  it('читает долю нового соавтора из цепи сразу после добавления', async () => {
    const { interactor, segmentSyncService } = makeInteractor();

    await interactor.addAuthor(addAuthorInput as any, {} as any);

    expect(segmentSyncService.syncSegment).toHaveBeenCalledTimes(1);
    const [coopname, projectHash, username] = segmentSyncService.syncSegment.mock.calls[0];
    expect(coopname).toBe('voskhod');
    expect(projectHash).toBe('ph');
    expect(username).toBe('ivan');
  });

  // cap.contrib.happy.04 — доля синхронизируется после проекта, а не вместо него
  it('обновляет и проект, и долю', async () => {
    const { interactor, projectSyncService, segmentSyncService } = makeInteractor();

    await interactor.addAuthor(addAuthorInput as any, {} as any);

    expect(projectSyncService.syncProject).toHaveBeenCalledTimes(1);
    expect(segmentSyncService.syncSegment).toHaveBeenCalledTimes(1);
  });

  // cap.contrib.side.06
  it('не отменяет добавление, если доля ещё не видна в цепи', async () => {
    const { interactor } = makeInteractor({ syncedSegment: null });

    await expect(interactor.addAuthor(addAuthorInput as any, {} as any)).resolves.toBeTruthy();
  });
});
