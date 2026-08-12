import {
  IssueAccessPolicyService,
  ProjectAction,
  ProjectUserRole,
} from '../../../src/extensions/capital/domain/services/access-policy.service';
import { PermissionsService } from '../../../src/extensions/capital/application/services/permissions.service';
import { ProjectPermissionsService } from '../../../src/extensions/capital/application/services/project-permissions.service';
import { PermissionsLookupCache } from '../../../src/extensions/capital/application/services/permissions-lookup-cache';

/**
 * Доступ к документам проекта и к его переписке.
 *
 * Правило: документы читают совет, ведущий, соавтор и пайщик с допуском; переписку и записи
 * звонков — только совет и ведущий. Допуск к проекту переписку не открывает.
 */
describe('Матрица доступа: документы проекта и переписка', () => {
  const policy = new IssueAccessPolicyService();

  describe('Матрица прав', () => {
    it('председатель и член совета читают и документы, и переписку', () => {
      for (const role of [ProjectUserRole.CHAIRMAN, ProjectUserRole.BOARD_MEMBER]) {
        expect(policy.hasProjectPermission([role], ProjectAction.VIEW_ARTIFACTS)).toBe(true);
        expect(policy.hasProjectPermission([role], ProjectAction.READ_COMMUNICATION)).toBe(true);
      }
    });

    it('ведущий проекта читает и документы, и переписку', () => {
      expect(policy.hasProjectPermission([ProjectUserRole.MASTER], ProjectAction.VIEW_ARTIFACTS)).toBe(true);
      expect(policy.hasProjectPermission([ProjectUserRole.MASTER], ProjectAction.READ_COMMUNICATION)).toBe(true);
    });

    it('допущенный пайщик читает документы, но не переписку', () => {
      expect(policy.hasProjectPermission([ProjectUserRole.CONTRIBUTOR], ProjectAction.VIEW_ARTIFACTS)).toBe(true);
      expect(policy.hasProjectPermission([ProjectUserRole.CONTRIBUTOR], ProjectAction.READ_COMMUNICATION)).toBe(false);
    });

    it('соавтор читает документы, но не переписку', () => {
      expect(policy.hasProjectPermission([ProjectUserRole.AUTHOR], ProjectAction.VIEW_ARTIFACTS)).toBe(true);
      expect(policy.hasProjectPermission([ProjectUserRole.AUTHOR], ProjectAction.READ_COMMUNICATION)).toBe(false);
    });

    it('без роли на проекте не читается ничего', () => {
      expect(policy.hasProjectPermission([ProjectUserRole.GUEST], ProjectAction.VIEW_ARTIFACTS)).toBe(false);
      expect(policy.hasProjectPermission([ProjectUserRole.GUEST], ProjectAction.READ_COMMUNICATION)).toBe(false);
    });

    it('допущенный, ставший ведущим, получает переписку по объединению ролей', () => {
      const roles = [ProjectUserRole.CONTRIBUTOR, ProjectUserRole.MASTER];
      expect(policy.hasProjectPermission(roles, ProjectAction.READ_COMMUNICATION)).toBe(true);
    });
  });

  describe('PermissionsService поверх матрицы', () => {
    const COOP = 'voskhod';
    const PROJECT = 'aaaa';
    const COMPONENT = 'bbbb';

    interface FakeProject {
      project_hash: string;
      coopname: string;
      master: string;
      parent_hash?: string | null;
    }

    const projects: Record<string, FakeProject> = {
      [PROJECT]: { project_hash: PROJECT, coopname: COOP, master: 'vedushchiy' },
      [COMPONENT]: { project_hash: COMPONENT, coopname: COOP, master: 'nikto', parent_hash: PROJECT },
    };

    /** Подтверждённые допуски: username → список project_hash. */
    const clearances: Record<string, string[]> = { dopushchennyy: [PROJECT] };
    /** Соавторства: username → список project_hash. */
    const authorships: Record<string, string[]> = { soavtor: [PROJECT] };

    function buildService(): PermissionsService {
      const projectRepository = {
        findByHash: jest.fn(async (hash: string) => projects[hash] ?? null),
        findByMaster: jest.fn(async (username: string) =>
          Object.values(projects).filter((p) => p.master === username)
        ),
        findComponentsByParentHash: jest.fn(async (parentHash: string) =>
          Object.values(projects).filter((p) => p.parent_hash === parentHash)
        ),
      };
      const appendixRepository = {
        findConfirmedByUsernameAndProjectHash: jest.fn(async (username: string, projectHash: string) =>
          (clearances[username] ?? []).includes(projectHash) ? { username, projectHash } : null
        ),
        findCreatedByUsernameAndProjectHash: jest.fn(async () => null),
        findDistinctProjectHashesWithConfirmedClearanceByUsername: jest.fn(
          async (username: string) => clearances[username] ?? []
        ),
      };
      const segmentRepository = {
        findOne: jest.fn(async (filter: { username?: string; project_hash?: string }) => {
          const owned = authorships[filter.username ?? ''] ?? [];
          return owned.includes(filter.project_hash ?? '') ? { is_author: true } : null;
        }),
        findAllPaginated: jest.fn(async (filter: { username?: string }) => ({
          items: (authorships[filter.username ?? ''] ?? []).map((project_hash) => ({ project_hash })),
          totalCount: 0,
          totalPages: 0,
          currentPage: 1,
        })),
      };
      const projectPermissions = new ProjectPermissionsService(
        projectRepository as never,
        { findByUsernameAndCoopname: jest.fn(async () => null) } as never,
        segmentRepository as never,
        policy
      );
      return new PermissionsService(
        projectRepository as never,
        appendixRepository as never,
        segmentRepository as never,
        { getUserRoleForIssue: jest.fn(), hasPermission: jest.fn() } as never,
        projectPermissions
      );
    }

    it('ведущий читает и документы, и переписку своего проекта', async () => {
      const service = buildService();
      const actor = { username: 'vedushchiy', role: 'user' };
      await expect(service.canViewProjectArtifacts(projects[PROJECT] as never, actor)).resolves.toBe(true);
      await expect(service.canReadProjectCommunication(PROJECT, actor)).resolves.toBe(true);
    });

    it('допущенный читает документы, но получает отказ на переписку', async () => {
      const service = buildService();
      const actor = { username: 'dopushchennyy', role: 'user' };
      await expect(service.canViewProjectArtifacts(projects[PROJECT] as never, actor)).resolves.toBe(true);
      await expect(service.canReadProjectCommunication(PROJECT, actor)).resolves.toBe(false);
    });

    it('член совета читает переписку любого проекта без допуска', async () => {
      const service = buildService();
      const actor = { username: 'sovetnik', role: 'member' };
      await expect(service.canReadProjectCommunication(PROJECT, actor)).resolves.toBe(true);
    });

    it('посторонний пайщик не читает ни документы, ни переписку', async () => {
      const service = buildService();
      const actor = { username: 'postoronniy', role: 'user' };
      await expect(service.canViewProjectArtifacts(projects[PROJECT] as never, actor)).resolves.toBe(false);
      await expect(service.canReadProjectCommunication(PROJECT, actor)).resolves.toBe(false);
    });

    it('ведущий проекта читает переписку его компонента (каскад вниз)', async () => {
      const service = buildService();
      const actor = { username: 'vedushchiy', role: 'user' };
      await expect(service.canReadProjectCommunication(COMPONENT, actor)).resolves.toBe(true);
    });

    it('допуск к проекту открывает документы компонента, но не его переписку', async () => {
      const service = buildService();
      const actor = { username: 'dopushchennyy', role: 'user' };
      await expect(service.canViewProjectArtifacts(projects[COMPONENT] as never, actor)).resolves.toBe(true);
      await expect(service.canReadProjectCommunication(COMPONENT, actor)).resolves.toBe(false);
    });

    it('переписки несуществующего проекта нет ни у кого, кроме совета', async () => {
      const service = buildService();
      await expect(
        service.canReadProjectCommunication('нет-такого', { username: 'vedushchiy', role: 'user' })
      ).resolves.toBe(false);
    });

    describe('область доступа для общих списков', () => {
      it('совету ограничения не ставится', async () => {
        const service = buildService();
        await expect(
          service.listAccessibleProjectHashes(ProjectAction.VIEW_ARTIFACTS, {
            username: 'predsedatel',
            role: 'chairman',
          })
        ).resolves.toBeNull();
      });

      it('ведущему — его проект и компоненты этого проекта', async () => {
        const service = buildService();
        const scope = await service.listAccessibleProjectHashes(ProjectAction.VIEW_ARTIFACTS, {
          username: 'vedushchiy',
          role: 'user',
        });
        expect(scope).not.toBeNull();
        expect([...(scope as Set<string>)].sort()).toEqual([COMPONENT, PROJECT].sort());
      });

      it('допущенному по документам — проект с допуском и его компоненты', async () => {
        const service = buildService();
        const scope = await service.listAccessibleProjectHashes(ProjectAction.VIEW_ARTIFACTS, {
          username: 'dopushchennyy',
          role: 'user',
        });
        expect([...(scope as Set<string>)].sort()).toEqual([COMPONENT, PROJECT].sort());
      });

      it('допущенному по переписке — пусто: роль допуска её не открывает', async () => {
        const service = buildService();
        const scope = await service.listAccessibleProjectHashes(ProjectAction.READ_COMMUNICATION, {
          username: 'dopushchennyy',
          role: 'user',
        });
        expect([...(scope as Set<string>)]).toEqual([]);
      });

      it('соавтору — документы его проекта (роль включена в матрице)', async () => {
        const service = buildService();
        const scope = await service.listAccessibleProjectHashes(ProjectAction.VIEW_ARTIFACTS, {
          username: 'soavtor',
          role: 'user',
        });
        expect([...(scope as Set<string>)].sort()).toEqual([COMPONENT, PROJECT].sort());
      });

      it('неавторизованному — пустая область, а не отсутствие ограничения', async () => {
        const service = buildService();
        const scope = await service.listAccessibleProjectHashes(ProjectAction.VIEW_ARTIFACTS, undefined);
        expect(scope).not.toBeNull();
        expect([...(scope as Set<string>)]).toEqual([]);
      });
    });
  });
});

describe('PermissionsLookupCache — кэш справочных чтений на один расчёт', () => {
  it('одно и то же значение грузится один раз', async () => {
    const cache = new PermissionsLookupCache();
    const load = jest.fn(async () => 'значение');
    const [a, b] = await Promise.all([
      cache.once('ключ', load),
      cache.once('ключ', load),
    ]);
    expect(a).toBe('значение');
    expect(b).toBe('значение');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('разные ключи не смешиваются', async () => {
    const cache = new PermissionsLookupCache();
    await expect(cache.once('первый', async () => 1)).resolves.toBe(1);
    await expect(cache.once('второй', async () => 2)).resolves.toBe(2);
  });

  it('неудачное чтение не кэшируется — следующий вызов пробует снова', async () => {
    const cache = new PermissionsLookupCache();
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('сеть недоступна'))
      .mockResolvedValueOnce('получилось');
    await expect(cache.once('ключ', load)).rejects.toThrow('сеть недоступна');
    await expect(cache.once('ключ', load)).resolves.toBe('получилось');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
