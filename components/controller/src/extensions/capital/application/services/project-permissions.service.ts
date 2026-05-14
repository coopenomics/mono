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
   * @returns множество project-ролей пользователя; пустого множества не бывает —
   *          минимум {@link ProjectUserRole.GUEST}.
   */
  async getProjectUserRole(
    username: string | undefined,
    project: any,
    userRole?: string
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
    const isMaster = await this.isProjectMaster(username, project.coopname, project.project_hash);
    if (isMaster) {
      roles.add(ProjectUserRole.MASTER);
    }

    const segment = await this.segmentRepository.findOne({
      username,
      project_hash: project.project_hash,
      coopname: project.coopname,
    });
    if (segment?.is_author) {
      roles.add(ProjectUserRole.AUTHOR);
    }

    const contributor = await this.contributorRepository.findByUsernameAndCoopname(username, project.coopname);
    if (contributor && contributor.appendixes?.includes(project.project_hash)) {
      roles.add(ProjectUserRole.CONTRIBUTOR);
    }

    if (roles.size === 0) {
      roles.add(ProjectUserRole.GUEST);
    }

    return roles;
  }

  /**
   * Проверяет, является ли пользователь мастером проекта
   * @param username - имя пользователя
   * @param coopname - имя кооператива
   * @param projectHash - хеш проекта
   * @returns true если пользователь является мастером
   */
  private async isProjectMaster(username: string, coopname: string, projectHash: string): Promise<boolean> {
    const project = await this.projectRepository.findByHash(projectHash);
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
