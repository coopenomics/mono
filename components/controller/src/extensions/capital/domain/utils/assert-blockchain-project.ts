import { ProjectOrigin } from '../enums/project-origin.enum';
import type { ProjectDomainEntity } from '../entities/project.entity';

/**
 * Кооперативные (блокчейн) операции запрещены для персональных LOCAL-проектов.
 */
export function assertBlockchainProject(
  project: ProjectDomainEntity | null | undefined,
  actionLabel = 'это действие'
): asserts project is ProjectDomainEntity {
  if (!project) {
    throw new Error('Проект не найден');
  }
  if (project.origin === ProjectOrigin.LOCAL) {
    throw new Error(
      `Персональный проект нельзя использовать для «${actionLabel}» — только кооперативные проекты из блокчейна`
    );
  }
}

export function isLocalProject(project: ProjectDomainEntity | null | undefined): boolean {
  return project?.origin === ProjectOrigin.LOCAL;
}
