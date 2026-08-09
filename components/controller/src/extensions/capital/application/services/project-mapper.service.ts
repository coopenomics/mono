import { Injectable } from '@nestjs/common';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { ProjectOutputDTO, ProjectComponentOutputDTO, BaseProjectOutputDTO } from '../dto/project_management/project.dto';
import { PermissionsService } from './permissions.service';
import type { IMonoAccount } from '@coopenomics/innercoop';

/** GraphQL CapitalProject.created_at: String! — Date из TypeORM недопустим. */
function toCreatedAtString(value: unknown): string {
  if (typeof value === 'string' && value) return value;
  if (value instanceof Date) return value.toISOString();
  if (value != null) {
    const d = new Date(value as string | number);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Сервис для маппинга доменных сущностей проектов в DTO
 * Централизует логику преобразования и обогащения проектов правами доступа
 */
@Injectable()
export class ProjectMapperService {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * Маппинг одного проекта в BaseProjectOutputDTO
   * Используется когда не нужно возвращать компоненты
   */
  async mapToBaseDTO(project: ProjectDomainEntity, currentUser?: IMonoAccount): Promise<BaseProjectOutputDTO> {
    // Рассчитываем права доступа для проекта
    const permissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);

    return {
      ...project,
      created_at: toCreatedAtString(project.created_at),
      permissions,
    } as BaseProjectOutputDTO;
  }

  /**
   * Маппинг одного проекта в ProjectOutputDTO (без компонентов)
   * Используется для простых случаев без компонентов
   */
  async mapToDTO(project: ProjectDomainEntity, currentUser?: IMonoAccount): Promise<ProjectOutputDTO> {
    // Рассчитываем права доступа для проекта
    const permissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);

    return {
      ...project,
      created_at: toCreatedAtString(project.created_at),
      permissions,
      // SDK projectSelector всегда запрашивает components — без массива GraphQL падает на non-null
      components: [],
    } as ProjectOutputDTO;
  }

  /**
   * Маппинг проекта с компонентами в ProjectOutputDTO
   * Компоненты должны быть добавлены в проект динамически через (project as any).components
   */
  async mapToDTOWithComponents(
    project: ProjectDomainEntity,
    currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO> {
    // Получаем компоненты (они добавлены динамически в репозитории)
    const components = (project as any).components as ProjectDomainEntity[] | undefined;

    // Собираем все проекты (родительский + компоненты) для расчета прав
    const allProjects = [project, ...(components || [])];

    // Рассчитываем права доступа для всех проектов пакетно
    const permissionsMap = await this.permissionsService.calculateBatchProjectPermissions(allProjects, currentUser);

    // Обогащаем проект и компоненты правами доступа
    const projectPermissions = permissionsMap.get(project.project_hash);

    const componentsWithPermissions = (components || []).map((component) => {
      const componentPermissions = permissionsMap.get(component.project_hash);
      return {
        ...component,
        created_at: toCreatedAtString(component.created_at),
        permissions: componentPermissions,
      } as ProjectComponentOutputDTO;
    });

    return {
      ...project,
      created_at: toCreatedAtString(project.created_at),
      permissions: projectPermissions,
      components: componentsWithPermissions,
    } as ProjectOutputDTO;
  }

  /**
   * Пакетный маппинг проектов в массив ProjectOutputDTO (без компонентов)
   * Оптимизирован для работы с большим количеством проектов
   */
  async mapBatchToDTO(
    projects: ProjectDomainEntity[],
    currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO[]> {
    // Рассчитываем права доступа для всех проектов пакетно
    const permissionsMap = await this.permissionsService.calculateBatchProjectPermissions(projects, currentUser);

    // Обогащаем проекты правами доступа
    return projects.map((project) => {
      const permissions = permissionsMap.get(project.project_hash);
      return {
        ...project,
        created_at: toCreatedAtString(project.created_at),
        permissions,
        components: [],
      } as ProjectOutputDTO;
    });
  }

  /**
   * Пакетный маппинг проектов с компонентами в массив ProjectOutputDTO
   * Обрабатывает как родительские проекты, так и их компоненты
   */
  async mapBatchToDTOWithComponents(
    projects: ProjectDomainEntity[],
    currentUser?: IMonoAccount
  ): Promise<ProjectOutputDTO[]> {
    // Собираем все проекты (родительские + компоненты) для расчета прав
    const allProjects = projects.flatMap((project) => {
      const components = (project as any).components as ProjectDomainEntity[] | undefined;
      return [project, ...(components || [])];
    });

    // Рассчитываем права доступа для всех проектов пакетно
    const permissionsMap = await this.permissionsService.calculateBatchProjectPermissions(allProjects, currentUser);

    // Обогащаем проекты правами доступа
    return projects.map((project) => {
      const projectPermissions = permissionsMap.get(project.project_hash);

      // Получаем компоненты (они добавлены динамически в репозитории)
      const components = (project as any).components as ProjectDomainEntity[] | undefined;

      // Обогащаем компоненты правами доступа
      const componentsWithPermissions = (components || []).map((component) => {
        const componentPermissions = permissionsMap.get(component.project_hash);
        return {
          ...component,
          created_at: toCreatedAtString(component.created_at),
          permissions: componentPermissions,
        } as ProjectComponentOutputDTO;
      });

      return {
        ...project,
        created_at: toCreatedAtString(project.created_at),
        permissions: projectPermissions,
        components: componentsWithPermissions,
      } as ProjectOutputDTO;
    });
  }

  /**
   * Пакетный маппинг проектов в массив BaseProjectOutputDTO
   * Используется в других модулях, где нужна базовая информация о проекте
   */
  async mapBatchToBaseDTO(
    projects: ProjectDomainEntity[],
    currentUser?: IMonoAccount
  ): Promise<BaseProjectOutputDTO[]> {
    // Рассчитываем права доступа для всех проектов пакетно
    const permissionsMap = await this.permissionsService.calculateBatchProjectPermissions(projects, currentUser);

    // Обогащаем проекты правами доступа
    return projects.map((project) => {
      const permissions = permissionsMap.get(project.project_hash);
      return {
        ...project,
        created_at: toCreatedAtString(project.created_at),
        permissions,
      } as BaseProjectOutputDTO;
    });
  }
}
