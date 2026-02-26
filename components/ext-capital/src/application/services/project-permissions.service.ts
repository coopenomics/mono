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
   * Определяет роль пользователя для конкретного проекта
   * @param username - имя пользователя
   * @param project - проект
   * @param userRole - роль пользователя в системе (chairman, member, etc.)
   * @returns роль пользователя для проекта
   */
  async getProjectUserRole(username: string | undefined, project: any, userRole?: string): Promise<ProjectUserRole> {
    // Гости не имеют доступа
    if (!username) {
      return ProjectUserRole.GUEST;
    }

    // Председатель совета имеет полные права
    if (userRole === 'chairman') {
      return ProjectUserRole.CHAIRMAN;
    }

    // Члены совета имеют расширенные права
    if (userRole === 'member') {
      return ProjectUserRole.BOARD_MEMBER;
    }

    // Проверяем, является ли пользователь мастером проекта
    const isMaster = await this.isProjectMaster(username, project.coopname, project.project_hash);
    if (isMaster) {
      return ProjectUserRole.MASTER;
    }

    // Проверяем, является ли пользователь автором проекта
    const segment = await this.segmentRepository.findOne({
      username,
      project_hash: project.project_hash,
      coopname: project.coopname,
    });
    if (segment?.is_author) {
      return ProjectUserRole.AUTHOR;
    }

    // Проверяем, является ли пользователь участником проекта
    const contributor = await this.contributorRepository.findByUsernameAndCoopname(username, project.coopname);
    if (contributor && contributor.appendixes?.includes(project.project_hash)) {
      return ProjectUserRole.CONTRIBUTOR;
    }

    // По умолчанию - гость
    return ProjectUserRole.GUEST;
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

  /**
   * Проверяет разрешение на действие
   * @param userRole - роль пользователя
   * @param action - действие
   * @returns true если действие разрешено
   */
  hasPermission(userRole: UserRole, action: IssueAction): boolean {
    return this.issueAccessPolicyService.hasPermission(userRole, action);
  }

  /**
   * Проверяет разрешение на действие над проектом
   * @param userRole - роль пользователя для проекта
   * @param action - действие над проектом
   * @returns true если действие разрешено
   */
  hasProjectPermission(userRole: ProjectUserRole, action: ProjectAction): boolean {
    return this.issueAccessPolicyService.hasProjectPermission(userRole, action);
  }

  /**
   * Проверяет разрешение на переход между статусами
   * @param userRole - роль пользователя
   * @param currentStatus - текущий статус
   * @param newStatus - новый статус
   * @returns true если переход разрешен
   */
  canTransitionStatus(userRole: UserRole, currentStatus: any, newStatus: any): boolean {
    return this.issueAccessPolicyService.canTransitionStatus(userRole, currentStatus, newStatus);
  }
}
