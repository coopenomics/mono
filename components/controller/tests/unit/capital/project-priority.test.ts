/**
 * Unit-тесты прав на управление приоритетами Благороста.
 *
 * Что здесь защищается. Приоритет расставляется «уровнем выше», поэтому
 * матрица project-ролей его не выражает и логика проверяется отдельно:
 * приоритет проекта ставит только председатель; приоритет компонента —
 * председатель или мастер родительского проекта (мастер самого компонента
 * себе приоритет не ставит); приоритет задачи — председатель или мастер
 * проекта/компонента задачи. Мутация без права не пишет в базу.
 *
 * Реестр случаев: test-registry/capital.priorities.yaml
 */

import { ProjectPermissionsService } from '~/extensions/capital/application/services/project-permissions.service';
import { IssuePermissionsService } from '~/extensions/capital/application/services/issue-permissions.service';
import { IssueAccessPolicyService } from '~/extensions/capital/domain/services/access-policy.service';
import { ProjectManagementService } from '~/extensions/capital/application/services/project-management.service';
import { ProjectPriority } from '~/extensions/capital/domain/enums/project-priority.enum';

const EMPTY_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const policy = new IssueAccessPolicyService();

function makeProjectRepo(byHash: Record<string, { master?: string; parent_hash?: string }>) {
  return {
    findByHash: jest.fn(async (hash: string) => byHash[hash] ?? null),
  };
}

const emptyContributorRepo = { findByUsernameAndCoopname: jest.fn().mockResolvedValue(null) };
const emptySegmentRepo = { findOne: jest.fn().mockResolvedValue(null) };

function makeProjectPermissionsService(byHash: Record<string, { master?: string; parent_hash?: string }>) {
  return new ProjectPermissionsService(
    makeProjectRepo(byHash) as never,
    emptyContributorRepo as never,
    emptySegmentRepo as never,
    policy
  );
}

describe('canSetProjectPriority — приоритет ставит уровень выше', () => {
  const component = { parent_hash: 'aa11' };
  const topProject = { parent_hash: EMPTY_HASH };
  const projects = { aa11: { master: 'parentmaster' } };

  it('председатель ставит приоритет и проекту, и компоненту', async () => {
    const svc = makeProjectPermissionsService(projects);
    await expect(svc.canSetProjectPriority('anyone', topProject, 'chairman')).resolves.toBe(true);
    await expect(svc.canSetProjectPriority('anyone', component, 'chairman')).resolves.toBe(true);
  });

  it('мастер родительского проекта ставит приоритет компоненту', async () => {
    const svc = makeProjectPermissionsService(projects);
    await expect(svc.canSetProjectPriority('parentmaster', component, 'user')).resolves.toBe(true);
  });

  it('мастер самого компонента приоритет себе не ставит', async () => {
    const svc = makeProjectPermissionsService({ aa11: { master: 'parentmaster' } });
    await expect(svc.canSetProjectPriority('componentmaster', component, 'user')).resolves.toBe(false);
  });

  it('верхнеуровневый проект закрыт даже для его мастера и члена совета', async () => {
    const svc = makeProjectPermissionsService(projects);
    await expect(svc.canSetProjectPriority('topmaster', topProject, 'user')).resolves.toBe(false);
    await expect(svc.canSetProjectPriority('boardguy', topProject, 'member')).resolves.toBe(false);
  });

  it('гость без имени — всегда отказ', async () => {
    const svc = makeProjectPermissionsService(projects);
    await expect(svc.canSetProjectPriority(undefined, component, undefined)).resolves.toBe(false);
  });
});

describe('setProjectPriority — мутация не пишет без права', () => {
  const project = { project_hash: 'bb22', coopname: 'voskhod' };

  function makeService(canSetPriority: boolean) {
    const interactor = {
      getProjectByHash: jest.fn().mockResolvedValue(project),
      setPriority: jest.fn().mockResolvedValue(project),
    };
    const mapper = {
      mapToDTO: jest.fn().mockResolvedValue({ permissions: { can_set_priority: canSetPriority } }),
    };
    const service = new ProjectManagementService(
      interactor as never,
      mapper as never,
      undefined as never,
      undefined as never
    );
    return { service, interactor };
  }

  it('без права — отказ, запись не тронута', async () => {
    const { service, interactor } = makeService(false);
    await expect(
      service.setProjectPriority({ project_hash: 'BB22', priority: ProjectPriority.URGENT })
    ).rejects.toThrow('Недостаточно прав');
    expect(interactor.setPriority).not.toHaveBeenCalled();
  });

  it('с правом — приоритет сохраняется по нормализованному хэшу', async () => {
    const { service, interactor } = makeService(true);
    await service.setProjectPriority({ project_hash: 'BB22', priority: ProjectPriority.URGENT });
    expect(interactor.getProjectByHash).toHaveBeenCalledWith('bb22');
    expect(interactor.setPriority).toHaveBeenCalledWith('bb22', ProjectPriority.URGENT);
  });
});

describe('validatePrioritySettingPermission — приоритет задач', () => {
  function makeIssuePermissionsService(byHash: Record<string, { master?: string; parent_hash?: string }>) {
    return new IssuePermissionsService(
      makeProjectRepo(byHash) as never,
      emptyContributorRepo as never,
      emptySegmentRepo as never,
      policy
    );
  }

  it('председатель проходит без справочных чтений', async () => {
    const repo = makeProjectRepo({});
    const svc = new IssuePermissionsService(
      repo as never,
      emptyContributorRepo as never,
      emptySegmentRepo as never,
      policy
    );
    await expect(
      svc.validatePrioritySettingPermission('chair', 'voskhod', 'cc33', undefined, [], 'chairman')
    ).resolves.toBeUndefined();
    expect(repo.findByHash).not.toHaveBeenCalled();
  });

  it('мастер родительского проекта компонента задачи проходит', async () => {
    const svc = makeIssuePermissionsService({
      cc33: { master: 'componentmaster', parent_hash: 'dd44' },
      dd44: { master: 'parentmaster' },
    });
    await expect(
      svc.validatePrioritySettingPermission('parentmaster', 'voskhod', 'cc33', undefined, [], 'user')
    ).resolves.toBeUndefined();
  });

  it('исполнитель задачи (не мастер) — отказ', async () => {
    const svc = makeIssuePermissionsService({ cc33: { master: 'somebody' } });
    await expect(
      svc.validatePrioritySettingPermission('worker', 'voskhod', 'cc33', 'worker', ['worker'], 'user')
    ).rejects.toThrow('приоритет');
  });
});
