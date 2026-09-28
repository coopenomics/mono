import { ProjectOrigin } from '../enums/project-origin.enum';
import type { ProjectDomainEntity } from '../entities/project.entity';
import { t } from '../../i18n';
import { DomainError } from '@coopenomics/extension-kit';

/**
 * Кооперативные (блокчейн) операции запрещены для персональных LOCAL-проектов.
 */
export function assertBlockchainProject(
  project: ProjectDomainEntity | null | undefined,
  actionLabel = t('capital.assertBlockchainProject.actionLabel.default')
): asserts project is ProjectDomainEntity {
  if (!project) {
    throw DomainError.notFound('CAPITAL_BLOCKCHAIN_PROJECT_NOT_FOUND');
  }
  if (project.origin === ProjectOrigin.LOCAL) {
    throw DomainError.forbidden('CAPITAL_PERSONAL_PROJECT_NOT_ALLOWED', { action: actionLabel });
  }
}

export function isLocalProject(project: ProjectDomainEntity | null | undefined): boolean {
  return project?.origin === ProjectOrigin.LOCAL;
}
