import { Injectable, Inject } from '@nestjs/common';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { CONTRIBUTOR_REPOSITORY, ContributorRepository } from '../../domain/repositories/contributor.repository';
import { SEGMENT_REPOSITORY, SegmentRepository } from '../../domain/repositories/segment.repository';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
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
 * Сервис для проверки прав доступа к задачам на основе матрицы доступа
 * Использует четко определенные правила для ролей и действий из доменного слоя
 */
@Injectable()
export class IssuePermissionsService {
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
   * Определяет роль пользователя для конкретной задачи
   * @param username - имя пользователя
   * @param coopname - имя кооператива
   * @param projectHash - хеш проекта
   * @param issueSubmaster - ответственный задачи
   * @param issueCreators - создатели задачи
   * @param userRole - роль пользователя в системе (chairman, member, etc.)
   * @returns роль пользователя
   */
  async getUserRoleForIssue(
    username: string | undefined,
    coopname: string,
    projectHash: string,
    issueSubmaster?: string,
    issueCreators?: string[],
    userRole?: string
  ): Promise<UserRole> {
    // Гости не имеют доступа
    if (!username) {
      return UserRole.GUEST;
    }

    // Сначала проверяем специфические роли проекта (они имеют приоритет над системными ролями)

    // Проверяем, является ли пользователь мастером проекта
    const isMaster = await this.isProjectMaster(username, coopname, projectHash);
    if (isMaster) {
      return UserRole.MASTER;
    }

    // Проверяем, является ли пользователь ответственным
    if (issueSubmaster === username) {
      return UserRole.SUBMASTER;
    }

    // Проверяем, является ли пользователь исполнителем (соисполнителем)
    if (issueCreators && issueCreators.includes(username)) {
      return UserRole.CREATOR;
    }

    // Проверяем, является ли пользователь автором проекта
    const segment = await this.segmentRepository.findOne({
      username,
      project_hash: projectHash,
      coopname,
    });
    if (segment?.is_author) {
      return UserRole.AUTHOR;
    }

    // Проверяем, является ли пользователь участником проекта
    const contributor = await this.contributorRepository.findByUsernameAndCoopname(username, coopname);
    if (contributor && contributor.appendixes.includes(projectHash)) {
      return UserRole.CONTRIBUTOR;
    }

    // Теперь проверяем системные роли (только если нет специфических ролей проекта)
    if (userRole === 'chairman' || userRole === 'member') {
      return UserRole.BOARD_MEMBER;
    }

    // По умолчанию - участник проекта (если есть доступ)
    return UserRole.CONTRIBUTOR;
  }

  /**
   * Проверяет, есть ли у пользователя разрешение на действие
   * @param userRole - роль пользователя
   * @param action - действие
   * @returns true если действие разрешено
   */
  hasPermission(userRole: UserRole, action: IssueAction): boolean {
    return this.issueAccessPolicyService.hasPermission(userRole, action);
  }

  /**
   * Проверяет разрешение на переход между статусами
   * @param userRole - роль пользователя
   * @param currentStatus - текущий статус
   * @param newStatus - новый статус
   * @returns true если переход разрешен
   */
  canTransitionStatus(userRole: UserRole, currentStatus: IssueStatus, newStatus: IssueStatus): boolean {
    return this.issueAccessPolicyService.canTransitionStatus(userRole, currentStatus, newStatus);
  }

  /**
   * Проверяет, является ли пользователь мастером проекта или связанного с ним компонента
   * @param username - имя пользователя
   * @param coopname - имя кооператива
   * @param projectHash - хеш проекта
   * @returns true, если пользователь является мастером
   */
  async isProjectMaster(username: string, coopname: string, projectHash: string): Promise<boolean> {
    // Находим проект
    const project = await this.projectRepository.findByHash(projectHash);
    if (!project) {
      throw new Error(`Проект с хэшем ${projectHash} не найден`);
    }

    // Проверяем, является ли пользователь мастером текущего проекта
    if (project.master === username) {
      return true;
    }

    // Если у проекта есть родительский проект (т.е. это компонент),
    // проверяем, является ли пользователь мастером родительского проекта
    if (project.parent_hash) {
      const parentProject = await this.projectRepository.findByHash(project.parent_hash);
      if (parentProject && parentProject.master === username) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверяет, является ли пользователь ответственным задачи
   * @param username - имя пользователя
   * @param issueSubmaster - ответственный задачи
   * @returns true, если пользователь является ответственным задачи
   */
  isIssueSubmaster(username: string, issueSubmaster?: string): boolean {
    return issueSubmaster === username;
  }

  /**
   * Проверяет права на назначение ответственного задачи
   * Только мастер проекта или компонента может назначать исполнителей на задачи
   * @param username - имя пользователя, пытающегося назначить исполнителя
   * @param coopname - имя кооператива
   * @param projectHash - хеш проекта задачи
   */
  async validateSubmasterAssignmentPermission(username: string, coopname: string, projectHash: string): Promise<void> {
    const isMaster = await this.isProjectMaster(username, coopname, projectHash);
    if (!isMaster) {
      throw new Error('Только мастер проекта или связанного с ним компонента может назначать исполнителей на задачи');
    }
  }

  /**
   * Определяет роль пользователя для проекта
   * @param username - имя пользователя
   * @param project - проект
   * @param userRole - системная роль пользователя (chairman, member, etc.)
   * @returns роль пользователя для проекта
   */
  async getProjectUserRole(
    username: string | undefined,
    project: any, // ProjectDomainEntity
    userRole?: string
  ): Promise<ProjectUserRole> {
    // Гости не имеют доступа
    if (!username) {
      return ProjectUserRole.GUEST;
    }

    // Члены совета имеют полные права
    if (userRole === 'chairman' || userRole === 'member') {
      return userRole === 'chairman' ? ProjectUserRole.CHAIRMAN : ProjectUserRole.BOARD_MEMBER;
    }

    // Проверяем, является ли пользователь мастером проекта
    const isMaster = await this.isProjectMaster(username, project.coopname, project.project_hash);
    if (isMaster) {
      return ProjectUserRole.MASTER;
    }

    // Проверяем, является ли пользователь участником проекта
    const contributor = await this.contributorRepository.findByUsernameAndCoopname(username, project.coopname);
    const isContributor = contributor && contributor.appendixes.includes(project.project_hash);

    if (isContributor) {
      return ProjectUserRole.CONTRIBUTOR;
    }

    // По умолчанию - участник (если есть доступ к проекту)
    return ProjectUserRole.CONTRIBUTOR;
  }

  /**
   * Проверяет, есть ли у пользователя разрешение на действие над проектом
   * @param userRole - роль пользователя для проекта
   * @param action - действие над проектом
   * @returns true если действие разрешено
   */
  hasProjectPermission(userRole: ProjectUserRole, action: ProjectAction): boolean {
    return this.issueAccessPolicyService.hasProjectPermission(userRole, action);
  }

  /**
   * Комплексная проверка прав на изменение статуса задачи через матрицу доступа
   * @param username - имя пользователя
   * @param coopname - имя кооператива
   * @param projectHash - хеш проекта задачи
   * @param issueSubmaster - ответственный задачи
   * @param issueCreators - массив создателей задачи
   * @param newStatus - новый статус задачи
   * @param currentStatus - текущий статус задачи
   * @param userRole - роль пользователя в системе
   */
  async validateIssueStatusPermission(
    username: string,
    coopname: string,
    projectHash: string,
    issueSubmaster: string | undefined,
    issueCreators: string[] | undefined,
    newStatus: IssueStatus,
    currentStatus: IssueStatus,
    userRole?: string
  ): Promise<void> {
    // Определяем роль пользователя
    const role = await this.getUserRoleForIssue(username, coopname, projectHash, issueSubmaster, issueCreators, userRole);

    // Проверяем разрешение на изменение статуса
    if (!this.hasPermission(role, IssueAction.CHANGE_STATUS)) {
      throw new Error(`У вас нет прав на изменение статуса задачи`);
    }

    // Проверяем разрешение на переход между статусами
    if (!this.canTransitionStatus(role, currentStatus, newStatus)) {
      throw new Error(`Переход из статуса "${currentStatus}" в "${newStatus}" запрещен для вашей роли`);
    }

    // Дополнительные проверки для специальных статусов
    if (newStatus === IssueStatus.DONE && !this.hasPermission(role, IssueAction.SET_DONE)) {
      throw new Error('Только мастер проекта может устанавливать статус "Выполнена"');
    }

    if (newStatus === IssueStatus.ON_REVIEW && !this.hasPermission(role, IssueAction.SET_ON_REVIEW)) {
      throw new Error('Только ответственный исполнитель может устанавливать статус "На проверке"');
    }
  }

  /**
   * Проверяет права на установку оценки (estimate) задачи
   * Только мастер проекта или компонента может устанавливать оценку на задачи
   * @param username - имя пользователя, пытающегося установить оценку
   * @param coopname - имя кооператива
   * @param projectHash - хеш проекта задачи
   * @param issueSubmaster - ответственный задачи
   * @param issueCreators - массив создателей задачи
   * @param userRole - роль пользователя в системе
   */
  async validateEstimateSettingPermission(
    username: string,
    coopname: string,
    projectHash: string,
    issueSubmaster: string | undefined,
    issueCreators: string[] | undefined,
    userRole?: string
  ): Promise<void> {
    // Определяем роль пользователя
    const role = await this.getUserRoleForIssue(username, coopname, projectHash, issueSubmaster, issueCreators, userRole);

    // Проверяем разрешение на установку оценки
    if (!this.hasPermission(role, IssueAction.SET_ESTIMATE)) {
      throw new Error('Только мастер проекта может устанавливать оценку на задачи');
    }
  }

  /**
   * Проверяет права на установку приоритета задачи
   * Только мастер проекта или компонента может устанавливать приоритет на задачи
   * @param username - имя пользователя, пытающегося установить приоритет
   * @param coopname - имя кооператива
   * @param projectHash - хеш проекта задачи
   * @param issueSubmaster - ответственный задачи
   * @param issueCreators - массив создателей задачи
   * @param userRole - роль пользователя в системе
   */
  async validatePrioritySettingPermission(
    username: string,
    coopname: string,
    projectHash: string,
    issueSubmaster: string | undefined,
    issueCreators: string[] | undefined,
    userRole?: string
  ): Promise<void> {
    // Определяем роль пользователя
    const role = await this.getUserRoleForIssue(username, coopname, projectHash, issueSubmaster, issueCreators, userRole);

    // Проверяем разрешение на установку приоритета
    if (!this.hasPermission(role, IssueAction.SET_PRIORITY)) {
      throw new Error('Только мастер проекта может устанавливать приоритет на задачи');
    }
  }

  /**
   * Получает список допустимых статусов для перехода из текущего статуса для данной роли
   * @param userRole - роль пользователя
   * @param currentStatus - текущий статус задачи
   * @returns массив допустимых статусов для перехода
   */
  getAllowedStatusTransitions(userRole: UserRole, currentStatus: IssueStatus): IssueStatus[] {
    return this.issueAccessPolicyService.getAllowedStatusTransitions(userRole, currentStatus);
  }
}
