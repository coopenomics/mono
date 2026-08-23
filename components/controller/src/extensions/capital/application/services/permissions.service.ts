import { Injectable, Inject } from '@nestjs/common';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import type { IssueDomainEntity } from '../../domain/entities/issue.entity';
import type { ProjectDomainEntity } from '../../domain/entities/project.entity';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { IssuePermissionsOutputDTO } from '../dto/generation/issue-permissions.dto';
import { ProjectPermissionsOutputDTO } from '../dto/project_management/project-permissions.dto';
import { IssuePermissionsService, IssueAction, ProjectAction } from './issue-permissions.service';
import { ProjectPermissionsService } from './project-permissions.service';
import { ProjectUserRole } from '../../domain/services/access-policy.service';
import { SEGMENT_REPOSITORY, type SegmentRepository } from '../../domain/repositories/segment.repository';
import type { IssueStatus } from '../../domain/enums/issue-status.enum';
import { ProjectStatus } from '../../domain/enums/project-status.enum';
import { ProjectOrigin } from '../../domain/enums/project-origin.enum';
import { PermissionsLookupCache } from './permissions-lookup-cache';

/**
 * Предел выборки сегментов при сборе проектов, где пайщик числится соавтором.
 * Соавторств у одного пайщика единицы; предел стоит только чтобы не тянуть таблицу целиком.
 */
const AUTHOR_SEGMENTS_SCAN_LIMIT = 500;

/**
 * Минимум сведений о пайщике, по которым решается доступ: имя и системная роль.
 * Отдельный тип, чтобы проверку можно было звать из смежного расширения, не собирая
 * весь профиль аккаунта.
 */
export type AccessActor = Pick<IMonoAccount, 'username' | 'role'>;

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
    @Inject(SEGMENT_REPOSITORY)
    private readonly segmentRepository: SegmentRepository,
    private readonly issuePermissionsService: IssuePermissionsService,
    private readonly projectPermissionsService: ProjectPermissionsService
  ) {}

  /**
   * Проверяет, является ли пользователь членом совета (chairman или member)
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns true если пользователь имеет роль chairman или member
   */
  private isBoardMember(currentUser?: AccessActor): boolean {
    const role = currentUser?.role;
    return role === 'chairman' || role === 'member';
  }

  /**
   * Проверяет, имеет ли пользователь роль chairman
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns true если пользователь имеет роль chairman
   */
  private isChairman(currentUser?: IMonoAccount): boolean {
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
  private async isProjectContributor(
    username: string | undefined,
    coopname: string,
    projectHash: string,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<boolean> {
    // Если username не указан, пользователь не является участником
    if (!username) {
      return false;
    }

    // Проверяем наличие подтвержденного приложения для конкретного проекта
    return cache.once(PermissionsLookupCache.confirmedClearanceKey(username, projectHash), async () => {
      const appendix = await this.appendixRepository.findConfirmedByUsernameAndProjectHash(username, projectHash);
      return appendix !== null;
    });
  }

  /**
   * Роли пользователя на проекте для решений о ЧТЕНИИ (документы, переписка).
   *
   * Отдельный набор от {@link ProjectPermissionsService.getProjectUserRole}, который решает
   * вопросы правки: там участник берётся из он-чейн списка приложений, а право читать даёт
   * именно подтверждённый допуск. Решение по ролям принимает матрица доступа, не этот метод.
   */
  private async resolveProjectReadRoles(
    project: ProjectDomainEntity,
    currentUser: AccessActor | undefined,
    cache: PermissionsLookupCache
  ): Promise<Set<ProjectUserRole>> {
    const roles = new Set<ProjectUserRole>();
    if (currentUser?.role === 'chairman') {
      roles.add(ProjectUserRole.CHAIRMAN);
    } else if (currentUser?.role === 'member') {
      roles.add(ProjectUserRole.BOARD_MEMBER);
    }
    const username = currentUser?.username;
    if (!username) {
      roles.add(ProjectUserRole.GUEST);
      return roles;
    }
    if (project.master === username) {
      roles.add(ProjectUserRole.MASTER);
    }
    const coopname = project.coopname;
    if (!coopname) {
      // Проект без кооператива — ни допуска, ни соавторства к нему не привязать.
      if (roles.size === 0) {
        roles.add(ProjectUserRole.GUEST);
      }
      return roles;
    }
    if (await this.isProjectContributor(username, coopname, project.project_hash, cache)) {
      roles.add(ProjectUserRole.CONTRIBUTOR);
    }
    const segment = await cache.once(
      PermissionsLookupCache.segmentKey(username, coopname, project.project_hash),
      () =>
        this.segmentRepository.findOne({
          username,
          project_hash: project.project_hash,
          coopname,
        })
    );
    if (segment?.is_author) {
      roles.add(ProjectUserRole.AUTHOR);
    }
    if (roles.size === 0) {
      roles.add(ProjectUserRole.GUEST);
    }
    return roles;
  }

  /**
   * Разрешено ли пользователю действие над проектом по матрице доступа.
   * Каскад вниз: роль на родительском проекте распространяется на его компоненты.
   */
  private async isProjectActionAllowed(
    project: ProjectDomainEntity,
    action: ProjectAction,
    currentUser: AccessActor | undefined,
    cache: PermissionsLookupCache
  ): Promise<boolean> {
    const roles = await this.resolveProjectReadRoles(project, currentUser, cache);
    if (this.projectPermissionsService.hasProjectPermission(roles, action)) {
      return true;
    }
    const parentHash = project.parent_hash;
    if (!parentHash) {
      return false;
    }
    const parent = await cache.once(PermissionsLookupCache.projectKey(parentHash), () =>
      this.projectRepository.findByHash(parentHash)
    );
    if (!parent) {
      return false;
    }
    const parentRoles = await this.resolveProjectReadRoles(parent, currentUser, cache);
    return this.projectPermissionsService.hasProjectPermission(parentRoles, action);
  }

  /**
   * Хеши проектов и компонентов, на которых пользователю разрешено действие, — для запросов,
   * где конкретный проект не назван (общие списки задач, требований, проектов; синхронизация
   * рабочей копии). Набор ролей и их права берутся из матрицы доступа: чтобы, например, открыть
   * переписку соавторам, достаточно поднять флаг в матрице, код здесь не меняется.
   *
   * @returns `null` — ограничения нет (роль совета разрешает действие на всех проектах);
   *          иначе множество хешей в нижнем регистре (может быть пустым).
   */
  async listAccessibleProjectHashes(
    action: ProjectAction,
    currentUser?: AccessActor,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<Set<string> | null> {
    const boardRole = this.boardRoleOf(currentUser);
    if (boardRole && this.projectPermissionsService.hasProjectPermission([boardRole], action)) {
      return null;
    }
    const username = currentUser?.username;
    if (!username) {
      return new Set<string>();
    }

    // Источники ролей опрашиваем только те, которым матрица разрешает действие.
    const wanted = (role: ProjectUserRole): boolean =>
      this.projectPermissionsService.hasProjectPermission([role], action);

    const [masterProjects, clearanceHashes, authorSegments] = await Promise.all([
      wanted(ProjectUserRole.MASTER) ? this.projectRepository.findByMaster(username) : Promise.resolve([]),
      wanted(ProjectUserRole.CONTRIBUTOR)
        ? this.appendixRepository.findDistinctProjectHashesWithConfirmedClearanceByUsername(username)
        : Promise.resolve([] as string[]),
      wanted(ProjectUserRole.AUTHOR)
        ? this.segmentRepository
            .findAllPaginated(
              { username, is_author: true },
              { page: 1, limit: AUTHOR_SEGMENTS_SCAN_LIMIT, sortOrder: 'ASC' }
            )
            .then((page) => page.items)
        : Promise.resolve([]),
    ]);

    const direct = new Set<string>();
    for (const project of masterProjects) {
      direct.add(project.project_hash.toLowerCase());
    }
    for (const hash of clearanceHashes) {
      const normalized = hash?.trim().toLowerCase();
      if (normalized) {
        direct.add(normalized);
      }
    }
    for (const segment of authorSegments) {
      const normalized = segment.project_hash?.trim().toLowerCase();
      if (normalized) {
        direct.add(normalized);
      }
    }
    if (direct.size === 0) {
      return direct;
    }

    // Каскад вниз: роль на проекте распространяется на его компоненты.
    const componentLists = await Promise.all(
      [...direct].map((hash) =>
        cache.once(PermissionsLookupCache.componentsKey(hash), () =>
          this.projectRepository.findComponentsByParentHash(hash)
        )
      )
    );

    const accessible = new Set<string>(direct);
    for (const components of componentLists) {
      for (const component of components) {
        accessible.add(component.project_hash.toLowerCase());
      }
    }
    return accessible;
  }

  /** Роль пользователя в совете для матрицы доступа, если он туда входит. */
  private boardRoleOf(currentUser?: AccessActor): ProjectUserRole | null {
    if (currentUser?.role === 'chairman') {
      return ProjectUserRole.CHAIRMAN;
    }
    if (currentUser?.role === 'member') {
      return ProjectUserRole.BOARD_MEMBER;
    }
    return null;
  }

  /**
   * Возвращает те хеши из переданного множества, документы которых пользователю разрешено
   * читать. Решение по каждому проекту принимает матрица доступа — те же правила, что и в
   * {@link canViewProjectArtifacts}, включая роли ведущего и соавтора, а не только допуск.
   *
   * Каскад вниз: если задан parentProjectHash и роль на нём разрешает чтение, доступны все
   * компоненты этого родителя.
   */
  async filterProjectHashesWithArtifactAccess(
    candidateHashes: string[],
    currentUser?: AccessActor,
    parentProjectHash?: string,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<string[]> {
    if (this.isBoardMember(currentUser)) {
      return [...candidateHashes];
    }
    const username = currentUser?.username;
    if (!username || candidateHashes.length === 0) {
      return [];
    }

    // Каскад через родительский проект: роль на нём открывает все его компоненты.
    if (parentProjectHash && (await this.canReadArtifactsOfHash(parentProjectHash, currentUser, cache))) {
      return [...candidateHashes];
    }

    const checks = await Promise.all(
      candidateHashes.map(async (hash) => {
        const allowed = await this.canReadArtifactsOfHash(hash, currentUser, cache);
        return allowed ? hash : null;
      })
    );
    return checks.filter((hash): hash is string => hash !== null);
  }

  /** Доступ к документам проекта по его хешу (проект грузится через кэш расчёта). */
  private async canReadArtifactsOfHash(
    projectHash: string,
    currentUser: AccessActor | undefined,
    cache: PermissionsLookupCache
  ): Promise<boolean> {
    const project = await cache.once(PermissionsLookupCache.projectKey(projectHash), () =>
      this.projectRepository.findByHash(projectHash)
    );
    if (!project) {
      return false;
    }
    return this.isProjectActionAllowed(project, ProjectAction.VIEW_ARTIFACTS, currentUser, cache);
  }

  /**
   * Проверяет, может ли пользователь просматривать артефакты конкретного проекта или компонента.
   * Председатель/член совета — да; иначе — собственный допуск или допуск к родителю.
   */
  async canViewProjectArtifacts(
    project: ProjectDomainEntity,
    currentUser?: AccessActor,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<boolean> {
    return this.isProjectActionAllowed(project, ProjectAction.VIEW_ARTIFACTS, currentUser, cache);
  }

  /**
   * Вправе ли пользователь читать переписку и записи звонков проекта.
   * Решает матрица доступа ({@link ProjectAction.READ_COMMUNICATION}): по умолчанию это совет и
   * ведущий проекта, а допуск к проекту сам по себе переписку не открывает.
   */
  async canReadProjectCommunication(
    projectHash: string,
    currentUser?: AccessActor,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<boolean> {
    const normalized = projectHash?.trim();
    if (!normalized) {
      return false;
    }
    const project = await cache.once(PermissionsLookupCache.projectKey(normalized), () =>
      this.projectRepository.findByHash(normalized)
    );
    if (!project) {
      return false;
    }
    return this.isProjectActionAllowed(project, ProjectAction.READ_COMMUNICATION, currentUser, cache);
  }


  /**
   * Рассчитывает права доступа пользователя к задаче через матрицу доступа
   * @param issue - задача
   * @param currentUser - текущий пользователь (может быть undefined для гостей)
   * @returns объект с флагами прав доступа
   */
  async calculateIssuePermissions(
    issue: IssueDomainEntity,
    currentUser?: IMonoAccount,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
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
        can_move_issue: false,
        can_create_requirement: false,
        can_edit_requirement: false,
        can_delete_requirement: false,
        can_complete_requirement: false,
        allowed_status_transitions: [] as IssueStatus[],
        has_clearance: false,
        is_guest: true,
      };
    }

    const username = currentUser.username;

    // Свободная задача — только участникам
    if (!issue.project_hash?.trim()) {
      const isParticipant =
        issue.created_by === username || (issue.creators?.includes(username) ?? false);
      if (!isParticipant) {
        return {
          can_edit_issue: false,
          can_change_status: false,
          can_assign_creator: false,
          can_set_done: false,
          can_set_on_review: false,
          can_set_estimate: false,
          can_set_priority: false,
          can_delete_issue: false,
          can_move_issue: false,
          can_create_requirement: false,
          can_edit_requirement: false,
          can_delete_requirement: false,
          can_complete_requirement: false,
          allowed_status_transitions: [] as IssueStatus[],
          has_clearance: false,
          is_guest: true,
        };
      }
    } else {
      // Задача в LOCAL-проекте — только владельцу проекта
      const issueProjectHash = issue.project_hash;
      const issueProject = await cache.once(PermissionsLookupCache.projectKey(issueProjectHash), () =>
        this.projectRepository.findByHash(issueProjectHash)
      );
      if (issueProject?.origin === ProjectOrigin.LOCAL) {
        const isOwner =
          issueProject.master === username || issueProject.local_owner === username;
        if (!isOwner) {
          return {
            can_edit_issue: false,
            can_change_status: false,
            can_assign_creator: false,
            can_set_done: false,
            can_set_on_review: false,
            can_set_estimate: false,
            can_set_priority: false,
            can_delete_issue: false,
            can_move_issue: false,
            can_create_requirement: false,
            can_edit_requirement: false,
            can_delete_requirement: false,
            can_complete_requirement: false,
            allowed_status_transitions: [] as IssueStatus[],
            has_clearance: false,
            is_guest: true,
          };
        }
      }
    }

    // Определяем НАБОР ролей пользователя для этой задачи (UNION-семантика).
    const roles = await this.issuePermissionsService.getUserRoleForIssue(
      username,
      issue.coopname,
      issue.project_hash ?? '',
      issue.submaster,
      issue.creators,
      currentUser.role,
      cache
    );

    // Проверяем наличие clearance (доступа к проекту)
    const has_clearance = issue.project_hash
      ? await this.isProjectContributor(username, issue.coopname, issue.project_hash, cache)
      : issue.creators?.includes(username) || issue.created_by === username;

    // Рассчитываем права на основе матрицы доступа
    const can_edit_issue = this.issuePermissionsService.hasPermission(roles, IssueAction.EDIT_ISSUE);
    const can_change_status = this.issuePermissionsService.hasPermission(roles, IssueAction.CHANGE_STATUS);
    const can_assign_creator = this.issuePermissionsService.hasPermission(roles, IssueAction.ASSIGN_CREATOR);
    const can_set_done = this.issuePermissionsService.hasPermission(roles, IssueAction.SET_DONE);
    const can_set_on_review = this.issuePermissionsService.hasPermission(roles, IssueAction.SET_ON_REVIEW);
    const can_set_estimate = this.issuePermissionsService.hasPermission(roles, IssueAction.SET_ESTIMATE);
    // Председатель управляет приоритетами всех кооперативных задач
    const can_set_priority =
      this.issuePermissionsService.hasPermission(roles, IssueAction.SET_PRIORITY) || this.isChairman(currentUser);
    const can_delete_issue = this.issuePermissionsService.hasPermission(roles, IssueAction.DELETE_ISSUE);
    const can_create_requirement = this.issuePermissionsService.hasPermission(roles, IssueAction.CREATE_REQUIREMENT);
    const can_edit_requirement = this.issuePermissionsService.hasPermission(roles, IssueAction.EDIT_REQUIREMENT);
    const can_delete_requirement = this.issuePermissionsService.hasPermission(roles, IssueAction.DELETE_REQUIREMENT);
    const can_complete_requirement = this.issuePermissionsService.hasPermission(roles, IssueAction.COMPLETE_REQUIREMENT);

    let can_move_issue = false;
    if (issue.project_hash) {
      const moveScopeHash = issue.project_hash;
      const issueProject = await cache.once(PermissionsLookupCache.projectKey(moveScopeHash), () =>
        this.projectRepository.findByHash(moveScopeHash)
      );

      if (issueProject?.isComponent()) {
        const projectPerms = await this.calculateProjectPermissions(issueProject, currentUser, cache);
        const st = issueProject.status;
        const projectOpenForMove = st === ProjectStatus.PENDING || st === ProjectStatus.ACTIVE;
        can_move_issue = projectPerms.can_manage_issues && projectOpenForMove;
      }
    } else {
      // Свободная задача: «переместить» = назначить компонент (нужно право редактировать)
      can_move_issue = can_edit_issue;
    }
    // Получаем допустимые переходы статусов для текущего статуса (UNION по ролям).
    const allowed_status_transitions = this.issuePermissionsService.getAllowedStatusTransitions(roles, issue.status);

    return {
      can_edit_issue,
      can_change_status,
      can_assign_creator,
      can_set_done,
      can_set_on_review,
      can_set_estimate,
      can_set_priority,
      can_delete_issue,
      can_move_issue,
      can_create_requirement,
      can_edit_requirement,
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
    currentUser?: IMonoAccount,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
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
        can_set_priority: false,
        can_create_requirement: false,
        can_edit_requirement: false,
        can_delete_requirement: false,
        can_complete_requirement: false,
        has_clearance: false,
        pending_clearance: false,
        has_parent_clearance: false,
        can_view_artifacts: false,
        is_guest: true,
      };
    }

    const username = currentUser.username;

    // Персональный проект: мастер/владелец — полный доступ к задачнику без допуска и кооперативных действий
    if (project.origin === ProjectOrigin.LOCAL) {
      const isOwner =
        project.master === username || project.local_owner === username;
      return {
        can_edit_project: isOwner,
        can_manage_issues: isOwner,
        can_change_project_status: false,
        can_delete_project: isOwner,
        can_set_master: false,
        can_manage_authors: false,
        can_set_plan: false,
        // Личный проект: приоритет — часть личного планирования владельца
        can_set_priority: isOwner,
        can_create_requirement: isOwner,
        can_edit_requirement: isOwner,
        can_delete_requirement: isOwner,
        can_complete_requirement: isOwner,
        has_clearance: isOwner,
        pending_clearance: false,
        has_parent_clearance: false,
        // Личные данные — только владельцу, даже членам совета
        can_view_artifacts: isOwner,
        is_guest: !isOwner,
      };
    }

    // Определяем НАБОР project-ролей пользователя (UNION-семантика).
    const roles = await this.projectPermissionsService.getProjectUserRole(
      username,
      project,
      currentUser.role,
      cache
    );

    // Проверяем наличие clearance (доступа к проекту)
    const has_clearance = project.coopname
      ? await this.isProjectContributor(username, project.coopname, project.project_hash, cache)
      : false;

    // Запрос на рассмотрении — только status=created и только если допуска ещё нет
    const pending_clearance =
      !has_clearance && project.coopname
        ? await cache.once(
            PermissionsLookupCache.createdClearanceKey(username, project.project_hash),
            async () =>
              (await this.appendixRepository.findCreatedByUsernameAndProjectHash(
                username,
                project.project_hash
              )) !== null
          )
        : false;

    // Проверяем допуск к родителю — каскадно вниз по иерархии проектов:
    // если есть допуск к корневому проекту, пользователь видит артефакты всех его компонентов.
    const has_parent_clearance = project.parent_hash && project.coopname
      ? await this.isProjectContributor(username, project.coopname, project.parent_hash, cache)
      : false;

    // Право просматривать артефакты: председатель/член совета — всегда; в остальных случаях —
    // собственный допуск ИЛИ допуск к родителю (для компонента).
    const can_view_artifacts = this.isBoardMember(currentUser) || has_clearance || has_parent_clearance;

    // Рассчитываем права на основе матрицы доступа
    const can_edit_project = this.projectPermissionsService.hasProjectPermission(roles, ProjectAction.EDIT_PROJECT);
    const can_manage_issues = this.projectPermissionsService.hasProjectPermission(roles, ProjectAction.MANAGE_ISSUES);
    const can_change_project_status = this.projectPermissionsService.hasProjectPermission(
      roles,
      ProjectAction.CHANGE_PROJECT_STATUS
    );
    const can_delete_project = this.projectPermissionsService.hasProjectPermission(roles, ProjectAction.DELETE_PROJECT);
    const can_set_master = this.projectPermissionsService.hasProjectPermission(roles, ProjectAction.SET_MASTER);
    const can_manage_authors = this.projectPermissionsService.hasProjectPermission(roles, ProjectAction.MANAGE_AUTHORS);
    const can_set_plan = this.projectPermissionsService.hasProjectPermission(roles, ProjectAction.SET_PLAN);
    const can_set_priority = await this.projectPermissionsService.canSetProjectPriority(
      username,
      project,
      currentUser.role,
      cache
    );
    const can_create_requirement = this.projectPermissionsService.hasProjectPermission(
      roles,
      ProjectAction.CREATE_REQUIREMENT
    );
    const can_edit_requirement = this.projectPermissionsService.hasProjectPermission(
      roles,
      ProjectAction.EDIT_REQUIREMENT
    );
    const can_delete_requirement = this.projectPermissionsService.hasProjectPermission(
      roles,
      ProjectAction.DELETE_REQUIREMENT
    );
    const can_complete_requirement = this.projectPermissionsService.hasProjectPermission(
      roles,
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
      can_set_priority,
      can_create_requirement,
      can_edit_requirement,
      can_delete_requirement,
      can_complete_requirement,
      has_clearance,
      pending_clearance,
      has_parent_clearance,
      can_view_artifacts,
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
    currentUser?: IMonoAccount,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<Map<string, IssuePermissionsOutputDTO>> {
    const permissionsMap = new Map<string, IssuePermissionsOutputDTO>();

    // Кэш общий на весь список: задачи одного проекта переспрашивают одни и те же
    // проект, допуск и участие — без него выборка из 200 задач даёт тысячи чтений.
    for (const issue of issues) {
      const permissions = await this.calculateIssuePermissions(issue, currentUser, cache);
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
    currentUser?: IMonoAccount,
    cache: PermissionsLookupCache = new PermissionsLookupCache()
  ): Promise<Map<string, ProjectPermissionsOutputDTO>> {
    const permissionsMap = new Map<string, ProjectPermissionsOutputDTO>();

    // Кэш общий на весь список — см. calculateBatchIssuePermissions.
    for (const project of projects) {
      const permissions = await this.calculateProjectPermissions(project, currentUser, cache);
      permissionsMap.set(project.project_hash, permissions);
    }

    return permissionsMap;
  }
}
