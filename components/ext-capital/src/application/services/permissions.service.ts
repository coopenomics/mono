import { Injectable, Inject } from '@nestjs/common';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import type { IssueDomainEntity } from '../../domain/entities/issue.entity';
import type { ProjectDomainEntity } from '../../domain/entities/project.entity';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { IssuePermissionsOutputDTO } from '../dto/generation/issue-permissions.dto';
import { ProjectPermissionsOutputDTO } from '../dto/project_management/project-permissions.dto';
import { IssuePermissionsService, IssueAction, ProjectAction } from './issue-permissions.service';
import { ProjectPermissionsService } from './project-permissions.service';
import type { IssueStatus } from '../../domain/enums/issue-status.enum';

/**
 * Сервис для расчета прав доступа пользователя к объектам CAPITAL системы
 * Централизует логику определения возможностей пользователя для задач и проектов
 */
@Injectable()
export class PermissionsService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository,
    private readonly issuePermissionsService: IssuePermissionsService,
    private readonly projectPermissionsService: ProjectPermissionsService
  ) {}

  /**
   * Проверяет, является ли пользователь членом совета (chairman или member)
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns true если пользователь имеет роль chairman или member
   */
  private isBoardMember(currentUser?: MonoAccountDomainInterface): boolean {
    const role = currentUser?.role;
    return role === 'chairman' || role === 'member';
  }

  /**
   * Проверяет, имеет ли пользователь роль chairman
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns true если пользователь имеет роль chairman
   */
  private isChairman(currentUser?: MonoAccountDomainInterface): boolean {
    return currentUser?.role === 'chairman';
  }

  /**
   * Проверяет, является ли пользователь мастером проекта
   * @param username - имя пользователя
   * @param project - проект
   * @returns true если пользователь является мастером проекта
   */
  private isProjectMaster(username: string, project: ProjectDomainEntity): boolean {
    return project.master === username;
  }

  /**
   * Проверяет, является ли пользователь мастером проекта или связанного с ним компонента
   * @param username - имя пользователя
   * @param projectHash - хеш проекта
   * @returns true если пользователь является мастером
   */
  async isProjectOrComponentMaster(username: string, projectHash: string): Promise<boolean> {
    // Находим проект
    const project = await this.projectRepository.findByHash(projectHash);
    if (!project) {
      return false;
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
   * Проверяет, является ли пользователь участником проекта
   * @param username - имя пользователя (может быть undefined для гостей)
   * @param coopname - имя кооператива
   * @param projectHash - хеш проекта
   * @returns true если пользователь является участником проекта (имеет подтвержденное приложение)
   */
  private async isProjectContributor(username: string | undefined, coopname: string, projectHash: string): Promise<boolean> {
    // Если username не указан, пользователь не является участником
    if (!username) {
      return false;
    }

    // Проверяем наличие подтвержденного приложения для конкретного проекта
    const appendix = await this.appendixRepository.findConfirmedByUsernameAndProjectHash(username, projectHash);
    return appendix !== null;
  }


  /**
   * Рассчитывает права доступа пользователя к задаче через матрицу доступа
   * @param issue - задача
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns объект с флагами прав доступа
   */
  async calculateIssuePermissions(
    issue: IssueDomainEntity,
    currentUser?: MonoAccountDomainInterface
  ): Promise<IssuePermissionsOutputDTO> {
    // Для гостей (неавторизованных пользователей) все права false
    if (!currentUser?.username) {
      return {
        can_edit_issue: false,
        can_change_status: false,
        can_assign_creator: false,
        can_set_done: false,
        can_set_on_review: false,
        can_set_estimate: false,
        can_set_priority: false,
        can_delete_issue: false,
        can_create_requirement: false,
        can_delete_requirement: false,
        can_complete_requirement: false,
        allowed_status_transitions: [] as IssueStatus[],
        has_clearance: false,
        is_guest: true,
      };
    }

    const username = currentUser.username;

    // Определяем роль пользователя для этой задачи
    const userRole = await this.issuePermissionsService.getUserRoleForIssue(
      username,
      issue.coopname,
      issue.project_hash,
      issue.submaster,
      issue.creators,
      currentUser.role
    );

    // Проверяем наличие clearance (доступа к проекту)
    const has_clearance = await this.isProjectContributor(username, issue.coopname, issue.project_hash);

    // Рассчитываем права на основе матрицы доступа
    const can_edit_issue = this.issuePermissionsService.hasPermission(userRole, IssueAction.EDIT_ISSUE);
    const can_change_status = this.issuePermissionsService.hasPermission(userRole, IssueAction.CHANGE_STATUS);
    const can_assign_creator = this.issuePermissionsService.hasPermission(userRole, IssueAction.ASSIGN_CREATOR);
    const can_set_done = this.issuePermissionsService.hasPermission(userRole, IssueAction.SET_DONE);
    const can_set_on_review = this.issuePermissionsService.hasPermission(userRole, IssueAction.SET_ON_REVIEW);
    const can_set_estimate = this.issuePermissionsService.hasPermission(userRole, IssueAction.SET_ESTIMATE);
    const can_set_priority = this.issuePermissionsService.hasPermission(userRole, IssueAction.SET_PRIORITY);
    const can_delete_issue = this.issuePermissionsService.hasPermission(userRole, IssueAction.DELETE_ISSUE);
    const can_create_requirement = this.issuePermissionsService.hasPermission(userRole, IssueAction.CREATE_REQUIREMENT);
    const can_delete_requirement = this.issuePermissionsService.hasPermission(userRole, IssueAction.DELETE_REQUIREMENT);
    const can_complete_requirement = this.issuePermissionsService.hasPermission(userRole, IssueAction.COMPLETE_REQUIREMENT);

    // Получаем допустимые переходы статусов для текущего статуса и роли
    const allowed_status_transitions = this.issuePermissionsService.getAllowedStatusTransitions(userRole, issue.status);

    return {
      can_edit_issue,
      can_change_status,
      can_assign_creator,
      can_set_done,
      can_set_on_review,
      can_set_estimate,
      can_set_priority,
      can_delete_issue,
      can_create_requirement,
      can_delete_requirement,
      can_complete_requirement,
      allowed_status_transitions,
      has_clearance,
      is_guest: false,
    };
  }

  /**
   * Рассчитывает права доступа пользователя к проекту через матрицу доступа
   * @param project - проект
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns объект с флагами прав доступа
   */
  async calculateProjectPermissions(
    project: ProjectDomainEntity,
    currentUser?: MonoAccountDomainInterface
  ): Promise<ProjectPermissionsOutputDTO> {
    // Для гостей (неавторизованных пользователей) все права false
    if (!currentUser?.username) {
      return {
        can_edit_project: false,
        can_manage_issues: false,
        can_change_project_status: false,
        can_delete_project: false,
        can_set_master: false,
        can_manage_authors: false,
        can_set_plan: false,
        can_create_requirement: false,
        can_delete_requirement: false,
        can_complete_requirement: false,
        has_clearance: false,
        pending_clearance: false,
        is_guest: true,
      };
    }

    const username = currentUser.username;

    // Определяем роль пользователя для этого проекта
    const userRole = await this.projectPermissionsService.getProjectUserRole(username, project, currentUser.role);

    // Проверяем наличие clearance (доступа к проекту)
    const has_clearance = project.coopname
      ? await this.isProjectContributor(username, project.coopname, project.project_hash)
      : false;

    // Проверяем наличие pending clearance
    const pending_clearance = project.coopname
      ? (await this.appendixRepository.findCreatedByUsernameAndProjectHash(username, project.project_hash)) !== null
      : false;

    // Рассчитываем права на основе матрицы доступа
    const can_edit_project = this.projectPermissionsService.hasProjectPermission(userRole, ProjectAction.EDIT_PROJECT);
    const can_manage_issues = this.projectPermissionsService.hasProjectPermission(userRole, ProjectAction.MANAGE_ISSUES);
    const can_change_project_status = this.projectPermissionsService.hasProjectPermission(
      userRole,
      ProjectAction.CHANGE_PROJECT_STATUS
    );
    const can_delete_project = this.projectPermissionsService.hasProjectPermission(userRole, ProjectAction.DELETE_PROJECT);
    const can_set_master = this.projectPermissionsService.hasProjectPermission(userRole, ProjectAction.SET_MASTER);
    const can_manage_authors = this.projectPermissionsService.hasProjectPermission(userRole, ProjectAction.MANAGE_AUTHORS);
    const can_set_plan = this.projectPermissionsService.hasProjectPermission(userRole, ProjectAction.SET_PLAN);
    const can_create_requirement = this.projectPermissionsService.hasProjectPermission(
      userRole,
      ProjectAction.CREATE_REQUIREMENT
    );
    const can_delete_requirement = this.projectPermissionsService.hasProjectPermission(
      userRole,
      ProjectAction.DELETE_REQUIREMENT
    );
    const can_complete_requirement = this.projectPermissionsService.hasProjectPermission(
      userRole,
      ProjectAction.COMPLETE_REQUIREMENT
    );

    return {
      can_edit_project,
      can_manage_issues,
      can_change_project_status,
      can_delete_project,
      can_set_master,
      can_manage_authors,
      can_set_plan,
      can_create_requirement,
      can_delete_requirement,
      can_complete_requirement,
      has_clearance,
      pending_clearance,
      is_guest: false,
    };
  }

  /**
   * Рассчитывает права доступа для массива задач
   * Оптимизирована для пакетной обработки
   * @param issues - массив задач
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns Map с правами доступа по хешу задачи
   */
  async calculateBatchIssuePermissions(
    issues: IssueDomainEntity[],
    currentUser?: MonoAccountDomainInterface
  ): Promise<Map<string, IssuePermissionsOutputDTO>> {
    const permissionsMap = new Map<string, IssuePermissionsOutputDTO>();

    // Для каждой задачи рассчитываем права доступа через основной метод
    for (const issue of issues) {
      const permissions = await this.calculateIssuePermissions(issue, currentUser);
      permissionsMap.set(issue.issue_hash, permissions);
    }

    return permissionsMap;
  }

  /**
   * Рассчитывает права доступа для массива проектов
   * Оптимизирована для пакетной обработки
   * @param projects - массив проектов
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns Map с правами доступа по хешу проекта
   */
  async calculateBatchProjectPermissions(
    projects: ProjectDomainEntity[],
    currentUser?: MonoAccountDomainInterface
  ): Promise<Map<string, ProjectPermissionsOutputDTO>> {
    const permissionsMap = new Map<string, ProjectPermissionsOutputDTO>();

    // Для каждого проекта рассчитываем права доступа через основной метод
    for (const project of projects) {
      const permissions = await this.calculateProjectPermissions(project, currentUser);
      permissionsMap.set(project.project_hash, permissions);
    }

    return permissionsMap;
  }
}
