/**
 * Unit-тесты отмены проекта.
 *
 * Что здесь защищается. Блокчейн при отмене возвращает средства и стирает
 * запись проекта — оперативная память цепи хранит только рабочее состояние.
 * Значит статус «отменён» больше неоткуда взять: если бэкенд не проставит его
 * в учётной базе сам, отменённый проект останется в ней с прежним статусом и
 * будет выглядеть живым. Тест фиксирует именно это, а не факт вызова порта.
 *
 * Реестр случаев: test-registry/capital.fund-allocation.yaml
 */

import { ProjectManagementInteractor } from '~/extensions/capital/application/use-cases/project-management.interactor';
import { ProjectOrigin } from '~/extensions/capital/domain/enums/project-origin.enum';
import { ProjectStatus } from '~/extensions/capital/domain/enums/project-status.enum';

function makeLoggerStub() {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

function makeProject(overrides: Record<string, any> = {}) {
  return {
    project_hash: 'ph',
    origin: ProjectOrigin.BLOCKCHAIN,
    status: ProjectStatus.ACTIVE,
    isComponent: () => false,
    ...overrides,
  } as any;
}

function makeInteractor(o: { project?: any } = {}) {
  const project = 'project' in o ? o.project : makeProject();

  const capitalBlockchainPort = {
    cancelProject: jest.fn(async () => ({ transaction_id: 'tx-1' })),
  } as any;

  const projectRepository = {
    findByHash: jest.fn(async () => project),
    update: jest.fn(async (entity: any) => entity),
  } as any;

  const componentMatrixAnnouncement = {
    removePinnedForDeletedComponent: jest.fn(),
  } as any;

  const interactor = new ProjectManagementInteractor(
    capitalBlockchainPort,
    projectRepository,
    makeLoggerStub(),
    {} as any,
    componentMatrixAnnouncement
  );

  return { interactor, capitalBlockchainPort, projectRepository, componentMatrixAnnouncement };
}

const cancelInput = { coopname: 'coop', project_hash: 'ph' } as any;

describe('ProjectManagementInteractor.cancelProject', () => {
  // cap.alloc.happy.07
  it('проставляет статус «отменён» в базе, потому что из цепи он уже не придёт', async () => {
    const { interactor, projectRepository } = makeInteractor();

    const result = await interactor.cancelProject(cancelInput);

    expect(result.status).toBe(ProjectStatus.CANCELLED);
    expect(projectRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: ProjectStatus.CANCELLED })
    );
  });

  // cap.alloc.side.19
  it('сохраняет статус только после успешной отмены в цепи', async () => {
    const { interactor, capitalBlockchainPort, projectRepository } = makeInteractor();
    capitalBlockchainPort.cancelProject.mockRejectedValueOnce(new Error('цепь недоступна'));

    await expect(interactor.cancelProject(cancelInput)).rejects.toThrow('цепь недоступна');
    expect(projectRepository.update).not.toHaveBeenCalled();
  });

  // cap.alloc.side.20
  it('отклоняет персональный LOCAL-проект до обращения к цепи', async () => {
    const { interactor, capitalBlockchainPort } = makeInteractor({
      project: makeProject({ origin: ProjectOrigin.LOCAL }),
    });

    await expect(interactor.cancelProject(cancelInput)).rejects.toThrow(/Персональный проект/);
    expect(capitalBlockchainPort.cancelProject).not.toHaveBeenCalled();
  });

  // cap.alloc.side.21
  it('снимает закреплённое объявление компонента при его отмене', async () => {
    const { interactor, componentMatrixAnnouncement } = makeInteractor({
      project: makeProject({ isComponent: () => true }),
    });

    await interactor.cancelProject(cancelInput);

    expect(componentMatrixAnnouncement.removePinnedForDeletedComponent).toHaveBeenCalled();
  });
});
