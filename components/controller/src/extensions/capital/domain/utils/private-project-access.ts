import { ProjectOrigin } from '../enums/project-origin.enum';
import type { ProjectDomainEntity } from '../entities/project.entity';
import type { IssueDomainEntity } from '../entities/issue.entity';
import { EMPTY_HASH } from '~/shared/utils/constants';

/** Владелец персонального проекта (мастер или local_owner). */
export function isLocalProjectOwner(
  project: ProjectDomainEntity | null | undefined,
  username?: string | null
): boolean {
  if (!project || !username) {
    return false;
  }
  return project.master === username || project.local_owner === username;
}

/** Персональный проект доступен только владельцу. */
export function canViewLocalProject(
  project: ProjectDomainEntity | null | undefined,
  username?: string | null
): boolean {
  if (!project) {
    return false;
  }
  if (project.origin !== ProjectOrigin.LOCAL) {
    return true;
  }
  return isLocalProjectOwner(project, username);
}

/** Участник свободной задачи (создатель или исполнитель). */
export function isFreeIssueParticipant(
  issue: IssueDomainEntity,
  username?: string | null
): boolean {
  if (!username) {
    return false;
  }
  return issue.created_by === username || (issue.creators?.includes(username) ?? false);
}

/**
 * Можно ли показать задачу текущему пользователю как личные данные:
 * - свободная — только участникам;
 * - в LOCAL-проекте — только владельцу проекта;
 * - в кооперативном — без доп. ограничения (обычные права).
 */
export function canViewPrivateScopedIssue(
  issue: IssueDomainEntity,
  project: ProjectDomainEntity | null | undefined,
  username?: string | null
): boolean {
  if (!issue.project_hash?.trim()) {
    return isFreeIssueParticipant(issue, username);
  }
  if (project?.origin === ProjectOrigin.LOCAL) {
    return isLocalProjectOwner(project, username);
  }
  return true;
}

function isEmptyProjectHash(projectHash?: string | null): boolean {
  const h = projectHash?.trim();
  return !h || h === EMPTY_HASH;
}

/**
 * Персональный учёт времени: свободная задача или LOCAL-проект.
 * Суточный hours_per_day на него не действует.
 */
export function isPersonalTimeScope(
  project: ProjectDomainEntity | null | undefined,
  projectHash?: string | null
): boolean {
  if (isEmptyProjectHash(projectHash)) {
    return true;
  }
  if (!project) {
    return true;
  }
  return project.origin === ProjectOrigin.LOCAL;
}

/** Кооперативный учёт времени (blockchain-проект). */
export function isCooperativeTimeProject(project: ProjectDomainEntity | null | undefined): boolean {
  return !!project && project.origin !== ProjectOrigin.LOCAL;
}
