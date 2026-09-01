/**
 * Unit-тесты снятия удалённой сущности с избранного.
 *
 * Что здесь защищается. Проекции capital'а не исчезают при удалении: у проекта
 * и компонента строка остаётся с `present = false`, у задачи и артефакта
 * удаляется, — а запись избранного жила своей жизнью и оставалась висеть.
 * Пайщик видел в меню звёздочку на несуществующей сущности, её страница
 * грузилась бесконечно, и снять её было нечем. Тесты фиксируют, что каждая
 * точка удаления снимает цель с избранного у всех пайщиков.
 *
 * Реестр случаев: test-registry/capital.favorites.yaml
 */

import { ProjectManagementInteractor } from '~/extensions/capital/application/use-cases/project-management.interactor';
import { GenerationService } from '~/extensions/capital/application/services/generation.service';
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

function makeProjectInteractor(origin: ProjectOrigin) {
  const project = {
    project_hash: 'ph',
    origin,
    isComponent: () => true,
  };

  const capitalBlockchainPort = {
    deleteProject: jest.fn(async () => ({ transaction: { ref_block_num: 7 } })),
  } as any;

  const projectRepository = {
    findByHash: jest.fn(async () => project),
    softDeleteLocal: jest.fn(async () => undefined),
  } as any;

  const favoriteRepository = {
    removeAllByTargetHash: jest.fn(async () => undefined),
  } as any;

  const componentMatrixAnnouncement = {
    removePinnedForDeletedComponent: jest.fn(),
  } as any;

  const interactor = new ProjectManagementInteractor(
    capitalBlockchainPort,
    projectRepository,
    makeLoggerStub(),
    {} as any,
    {} as any,
    {} as any,
    componentMatrixAnnouncement,
    favoriteRepository
  );

  return { interactor, capitalBlockchainPort, projectRepository, favoriteRepository };
}

const deleteInput = { coopname: 'voskhod', project_hash: 'ph' } as any;

describe('capital: удаление проекта и компонента снимает их с избранного', () => {
  // cap.fav.side.07
  it('персональный компонент: мягкое удаление сопровождается снятием с избранного', async () => {
    const { interactor, projectRepository, favoriteRepository } = makeProjectInteractor(
      ProjectOrigin.LOCAL
    );

    await interactor.deleteProject(deleteInput);

    expect(projectRepository.softDeleteLocal).toHaveBeenCalledWith('ph');
    expect(favoriteRepository.removeAllByTargetHash).toHaveBeenCalledWith('ph');
  });

  // cap.fav.side.07
  it('проект из цепи: после удаления в цепи запись избранного не остаётся', async () => {
    const { interactor, capitalBlockchainPort, favoriteRepository } = makeProjectInteractor(
      ProjectOrigin.BLOCKCHAIN
    );

    await interactor.deleteProject(deleteInput);

    expect(capitalBlockchainPort.deleteProject).toHaveBeenCalledTimes(1);
    expect(favoriteRepository.removeAllByTargetHash).toHaveBeenCalledWith('ph');
  });
});

describe('capital: удаление задачи и артефакта снимает их с избранного', () => {
  function makeGenerationService() {
    const service = Object.create(GenerationService.prototype) as any;

    service.favoriteRepository = { removeAllByTargetHash: jest.fn(async () => undefined) };
    service.storyRepository = {
      findByStoryHash: jest.fn(async () => ({
        _id: 'story-id',
        story_hash: 'sh',
        matrix_requirement_announcement_events: [],
      })),
      delete: jest.fn(async () => undefined),
    };
    service.issueRepository = {
      findByIssueHash: jest.fn(async () => ({ _id: 'issue-id', issue_hash: 'ih' })),
      delete: jest.fn(async () => undefined),
    };
    service.timeTrackingInteractor = {
      cleanupIssueTimeEntries: jest.fn(async () => undefined),
    };
    service.assertCanDeleteStoryRequirement = jest.fn(async () => undefined);
    service.removeStoryMatrixAnnouncements = jest.fn(async () => undefined);

    return service;
  }

  // cap.fav.side.08
  it('удалённая задача снимается с избранного у всех пайщиков', async () => {
    const service = makeGenerationService();

    await service.deleteIssueByHash('ih');

    expect(service.issueRepository.delete).toHaveBeenCalledWith('issue-id');
    expect(service.favoriteRepository.removeAllByTargetHash).toHaveBeenCalledWith('ih');
  });

  // cap.fav.side.08
  it('удалённый артефакт снимается с избранного у всех пайщиков', async () => {
    const service = makeGenerationService();

    await service.deleteStoryByHash('sh', {} as any);

    expect(service.storyRepository.delete).toHaveBeenCalledWith('story-id');
    expect(service.favoriteRepository.removeAllByTargetHash).toHaveBeenCalledWith('sh');
  });
});
