/**
 * Unit-тесты правки проекта, когда цепь её не принимает.
 *
 * Что здесь защищается. Правка сначала пишет текст в базу (редакция), потом
 * отправляет editproj. Если цепь отказала, база обязана остаться такой, какой
 * была до правки. 23.10.2026 правка завершённого проекта получила отказ цепи, а
 * откат вернул строке текст старой редакции вместо её прежнего содержимого.
 * Завершённый проект теперь отсекается до записи, а любой другой отказ цепи
 * откатывает подготовленную запись целиком.
 *
 * Реестр случаев: test-registry/capital.content-revisions.yaml
 */

import { ProjectManagementInteractor } from '~/extensions/capital/application/use-cases/project-management.interactor';
import { ProjectOrigin } from '~/extensions/capital/domain/enums/project-origin.enum';
import { ProjectStatus } from '~/extensions/capital/domain/enums/project-status.enum';
import { ContentEntityType } from '~/extensions/capital/domain/enums/content-entity-type.enum';

function makeLoggerStub() {
  return { setContext: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
}

const write = {
  title: 'Проект',
  description: 'новый текст',
  content_rev: 2,
  merged: false,
  changed: true,
  previous_rev: 1,
  previous: { title: 'Проект', description: '' },
};

function makeInteractor(o: { status?: ProjectStatus; chainError?: Error } = {}) {
  const project = { project_hash: 'ph', origin: ProjectOrigin.BLOCKCHAIN, status: o.status ?? ProjectStatus.ACTIVE };
  const capitalBlockchainPort = {
    editProject: jest.fn(async () => {
      if (o.chainError) throw o.chainError;
      return { transaction: { ref_block_num: 1 } };
    }),
  } as any;
  const projectRepository = { findByHash: jest.fn(async () => project) } as any;
  const projectSyncService = { syncProject: jest.fn(async () => project) } as any;
  const contentRevisionService = {
    prepareWrite: jest.fn(async () => write),
    rollbackWrite: jest.fn(async () => undefined),
  } as any;
  const interactor = new ProjectManagementInteractor(
    capitalBlockchainPort,
    projectRepository,
    makeLoggerStub(),
    projectSyncService,
    contentRevisionService,
    {} as any, // segmentSyncService
    {} as any, // componentMatrixAnnouncement
    {} as any // favoriteRepository
  );
  return { interactor, capitalBlockchainPort, contentRevisionService, projectSyncService };
}

const editInput = {
  coopname: 'voskhod',
  project_hash: 'ph',
  title: 'Проект',
  description: 'новый текст',
  invite: '',
  meta: '',
  data: '',
  base_rev: 1,
};

describe('capital: правка проекта при отказе цепи', () => {
  it('cap.rev.break.03: завершённый проект — отказ до записи, база и цепь не тронуты', async () => {
    const { interactor, capitalBlockchainPort, contentRevisionService } = makeInteractor({
      status: ProjectStatus.RESULT,
    });

    await expect(interactor.editProject(editInput as any, 'ant')).rejects.toMatchObject({
      code: 'CAPITAL_PROJECT_EDIT_COMPLETED',
    });
    expect(contentRevisionService.prepareWrite).not.toHaveBeenCalled();
    expect(capitalBlockchainPort.editProject).not.toHaveBeenCalled();
  });

  it('cap.rev.break.04: цепь отказала — откат получает подготовленную запись целиком, вызывающий получает ошибку цепи', async () => {
    const refusal = new Error('assertion failure with message: Нельзя редактировать завершенный проект');
    const { interactor, contentRevisionService, projectSyncService } = makeInteractor({ chainError: refusal });

    await expect(interactor.editProject(editInput as any, 'ant')).rejects.toBe(refusal);
    expect(contentRevisionService.rollbackWrite).toHaveBeenCalledWith(ContentEntityType.PROJECT, 'ph', write);
    expect(projectSyncService.syncProject).not.toHaveBeenCalled();
  });

  it('cap.rev.happy.03: цепь приняла правку — отката нет, проект синхронизируется', async () => {
    const { interactor, contentRevisionService, projectSyncService } = makeInteractor();

    await interactor.editProject(editInput as any, 'ant');
    expect(contentRevisionService.rollbackWrite).not.toHaveBeenCalled();
    expect(projectSyncService.syncProject).toHaveBeenCalledTimes(1);
  });
});
