import { Injectable, Inject } from '@nestjs/common';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { CONTRIBUTOR_REPOSITORY, ContributorRepository } from '../../domain/repositories/contributor.repository';
import { SEGMENT_REPOSITORY, SegmentRepository } from '../../domain/repositories/segment.repository';
import {
  IssueAccessPolicyService,
  UserRole,
  IssueAction,
  ProjectUserRole,
  ProjectAction,
} from '../../domain/services/access-policy.service';
import { PermissionsLookupCache } from './permissions-lookup-cache';
import { EMPTY_HASH } from '@coopenomics/extension-kit';

// Реэкспортируем типы для обратной совместимости
export { UserRole, IssueAction, ProjectUserRole, ProjectAction };

/**
 * Сервис для проверки прав доступа к проектам на основе матрицы доступа
 * Использует четко определенные правила для ролей и действий из доменного слоя
 */
@Injectable()
export class ProjectPermissionsService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository,
    @Inject(SEGMENT_REPOSITORY)
    private readonly segmentRepository: SegmentRepository,
    private readonly issueAccessPolicyService: IssueAccessPolicyService
  ) {}

  /**
   * Определяет НАБОР ролей пользователя для конкретного проекта.
   *
   * Один пользователь может одновременно быть, например, членом совета и
   * соавтором — итоговые права на проект считаются как UNION разрешений по
   * всем его ролям (см. {@link IssueAccessPolicyService.hasProjectPermission}).
   *
   * @param username - имя пользователя
   * @param project - проект
   * @param userRole - системная роль пользователя (chairman / member / ...)
   * @param cache - кэш справочных чтений на время одного расчёта (для списков)
   * @returns множество project-ролей пользователя; пустого множества не бывает —
   *          минимум {@link ProjectUserRole.GUEST}.
   */
  async getProjectUserRole(
    username: string | undefined,
    project: any,
    userRole?: string,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<Set<ProjectUserRole>> {
    const roles = new Set<ProjectUserRole>();

    if (!username) {
      roles.add(ProjectUserRole.GUEST);
      return roles;
    }

    // Системные роли совета — добавляем независимо от project-specific ролей.
    if (userRole === 'chairman') {
      roles.add(ProjectUserRole.CHAIRMAN);
    } else if (userRole === 'member') {
      roles.add(ProjectUserRole.BOARD_MEMBER);
    }

    // Project-specific роли — собираем все, что верны.
    const isMaster = await this.isProjectMaster(username, project.project_hash, cache);
    if (isMaster) {
      roles.add(ProjectUserRole.MASTER);
    }

    const segment = await cache.once(
      PermissionsLookupCache.segmentKey(username, project.coopname, project.project_hash),
      () =>
        this.segmentRepository.findOne({
          username,
          project_hash: project.project_hash,
          coopname: project.coopname,
        })
    );
    if (segment?.is_author) {
      roles.add(ProjectUserRole.AUTHOR);
    }

    const contributor = await cache.once(
      PermissionsLookupCache.contributorKey(username, project.coopname),
      () => this.contributorRepository.findByUsernameAndCoopname(username, project.coopname)
    );
    if (contributor && contributor.appendixes?.includes(project.project_hash)) {
      roles.add(ProjectUserRole.CONTRIBUTOR);
    }

    if (roles.size === 0) {
      roles.add(ProjectUserRole.GUEST);
    }

    return roles;
  }

  /**
   * Проверяет право устанавливать приоритет проекта/компонента.
   *
   * Приоритет расставляется «уровнем выше», поэтому матрица project-ролей его
   * не выражает: у верхнеуровневого проекта приоритет ставит только председатель,
   * у компонента — председатель или мастер родительского проекта (мастер самого
   * компонента приоритет себе не ставит — как исполнитель задачи не ставит
   * приоритет своей задаче).
   */
  async canSetProjectPriority(
    username: string | undefined,
    project: { parent_hash?: string | null },
    userRole?: string,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<boolean> {
    if (!username) return false;
    if (userRole === 'chairman') return true;

    const parentHash = (project.parent_hash || '').toLowerCase();
    if (!parentHash || parentHash === EMPTY_HASH.toLowerCase()) {
      return false;
    }
    const parent = await cache.once(PermissionsLookupCache.projectKey(parentHash), () =>
      this.projectRepository.findByHash(parentHash)
    );
    return parent?.master === username;
  }

  /**
   * Проверяет, является ли пользователь мастером проекта
   * @param username - имя пользователя
   * @param projectHash - хеш проекта
   * @param cache - кэш справочных чтений на время одного расчёта
   * @returns true если пользователь является мастером
   */
  private async isProjectMaster(
    username: string,
    projectHash: string,
    cache: PermissionsLookupCache
  ): Promise<boolean> {
    const project = await cache.once(PermissionsLookupCache.projectKey(projectHash), () =>
      this.projectRepository.findByHash(projectHash)
    );
    return project?.master === username;
  }

  /** UNION-проверка прав на действие над задачей по набору ролей. */
  hasPermission(roles: Iterable<UserRole>, action: IssueAction): boolean {
    return this.issueAccessPolicyService.hasPermission(roles, action);
  }

  /** UNION-проверка прав на действие над проектом по набору ролей. */
  hasProjectPermission(roles: Iterable<ProjectUserRole>, action: ProjectAction): boolean {
    return this.issueAccessPolicyService.hasProjectPermission(roles, action);
  }

  /** UNION-проверка перехода статусов по набору ролей. */
  canTransitionStatus(roles: Iterable<UserRole>, currentStatus: any, newStatus: any): boolean {
    return this.issueAccessPolicyService.canTransitionStatus(roles, currentStatus, newStatus);
  }
}
