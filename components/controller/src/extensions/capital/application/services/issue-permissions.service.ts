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
   * Определяет НАБОР ролей пользователя для конкретной задачи.
   *
   * Пользователь может одновременно нести несколько ролей (например, член совета
   * + соавтор + исполнитель), и итоговые права на задачу — UNION разрешений по
   * всем его ролям. См. {@link IssueAccessPolicyService.hasPermission}.
   *
   * @returns множество ролей; минимум {@link UserRole.GUEST} / {@link UserRole.CONTRIBUTOR}.
   */
  async getUserRoleForIssue(
    username: string | undefined,
    coopname: string,
    projectHash: string,
    issueSubmaster?: string,
    issueCreators?: string[],
    userRole?: string
  ): Promise<Set<UserRole>> {
    const roles = new Set<UserRole>();

    if (!username) {
      roles.add(UserRole.GUEST);
      return roles;
    }

    // Project-specific роли — собираем все, что верны.
    const isMaster = await this.isProjectMaster(username, coopname, projectHash);
    if (isMaster) {
      roles.add(UserRole.MASTER);
    }

    if (issueSubmaster === username) {
      roles.add(UserRole.SUBMASTER);
    }

    if (issueCreators && issueCreators.includes(username)) {
      roles.add(UserRole.CREATOR);
    }

    const segment = await this.segmentRepository.findOne({
      username,
      project_hash: projectHash,
      coopname,
    });
    if (segment?.is_author) {
      roles.add(UserRole.AUTHOR);
    }

    const contributor = await this.contributorRepository.findByUsernameAndCoopname(username, coopname);
    if (contributor && contributor.appendixes.includes(projectHash)) {
      roles.add(UserRole.CONTRIBUTOR);
    }

    // Системные роли совета — добавляем независимо от project-specific ролей.
    if (userRole === 'chairman' || userRole === 'member') {
      roles.add(UserRole.BOARD_MEMBER);
    }

    // Минимальный фолбэк, если ничего из вышеперечисленного не сработало,
    // но username известен — оставляем семантику «участник проекта».
    if (roles.size === 0) {
      roles.add(UserRole.CONTRIBUTOR);
    }

    return roles;
  }

  /** UNION-проверка прав на действие над задачей по набору ролей. */
  hasPermission(roles: Iterable<UserRole>, action: IssueAction): boolean {
    return this.issueAccessPolicyService.hasPermission(roles, action);
  }

  /** UNION-проверка перехода статусов по набору ролей. */
  canTransitionStatus(roles: Iterable<UserRole>, currentStatus: IssueStatus, newStatus: IssueStatus): boolean {
    return this.issueAccessPolicyService.canTransitionStatus(roles, currentStatus, newStatus);
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
   * Определяет НАБОР project-ролей пользователя.
   *
   * UNION-семантика по ролям. Симметрично с
   * {@link ProjectPermissionsService.getProjectUserRole}.
   */
  async getProjectUserRole(
    username: string | undefined,
    project: any, // ProjectDomainEntity
    userRole?: string
  ): Promise<Set<ProjectUserRole>> {
    const roles = new Set<ProjectUserRole>();

    if (!username) {
      roles.add(ProjectUserRole.GUEST);
      return roles;
    }

    if (userRole === 'chairman') {
      roles.add(ProjectUserRole.CHAIRMAN);
    } else if (userRole === 'member') {
      roles.add(ProjectUserRole.BOARD_MEMBER);
    }

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
    if (contributor && contributor.appendixes.includes(project.project_hash)) {
      roles.add(ProjectUserRole.CONTRIBUTOR);
    }

    if (roles.size === 0) {
      roles.add(ProjectUserRole.CONTRIBUTOR);
    }

    return roles;
  }

  /** UNION-проверка прав на действие над проектом по набору ролей. */
  hasProjectPermission(roles: Iterable<ProjectUserRole>, action: ProjectAction): boolean {
    return this.issueAccessPolicyService.hasProjectPermission(roles, action);
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
    // Определяем набор ролей пользователя
    const roles = await this.getUserRoleForIssue(username, coopname, projectHash, issueSubmaster, issueCreators, userRole);

    if (!this.hasPermission(roles, IssueAction.CHANGE_STATUS)) {
      throw new Error(`У вас нет прав на изменение статуса задачи`);
    }

    if (!this.canTransitionStatus(roles, currentStatus, newStatus)) {
      throw new Error(`Переход из статуса "${currentStatus}" в "${newStatus}" запрещен для вашей роли`);
    }

    if (newStatus === IssueStatus.DONE && !this.hasPermission(roles, IssueAction.SET_DONE)) {
      throw new Error('Только мастер проекта может устанавливать статус "Выполнена"');
    }

    if (newStatus === IssueStatus.ON_REVIEW && !this.hasPermission(roles, IssueAction.SET_ON_REVIEW)) {
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
    // Определяем набор ролей пользователя
    const roles = await this.getUserRoleForIssue(username, coopname, projectHash, issueSubmaster, issueCreators, userRole);

    if (!this.hasPermission(roles, IssueAction.SET_ESTIMATE)) {
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
    // Определяем набор ролей пользователя
    const roles = await this.getUserRoleForIssue(username, coopname, projectHash, issueSubmaster, issueCreators, userRole);

    if (!this.hasPermission(roles, IssueAction.SET_PRIORITY)) {
      throw new Error('Только мастер проекта может устанавливать приоритет на задачи');
    }
  }

  /** UNION-список допустимых переходов статуса по набору ролей. */
  getAllowedStatusTransitions(roles: Iterable<UserRole>, currentStatus: IssueStatus): IssueStatus[] {
    return this.issueAccessPolicyService.getAllowedStatusTransitions(roles, currentStatus);
  }
}
