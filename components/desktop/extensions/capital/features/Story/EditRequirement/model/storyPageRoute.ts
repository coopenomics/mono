import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IStory } from 'app/extensions/capital/entities/Story/model';
import { capitalRouteName } from 'app/extensions/capital/shared/lib/capitalWorkspaceRoutes';

/**
 * Проект-владелец артефакта: у артефакта задачи это проект задачи,
 * иначе — проект, к которому артефакт привязан напрямую.
 */
export async function resolveStoryOwnerProjectHash(story: IStory): Promise<string | undefined> {
  if (story.issue_hash) {
    try {
      const issue = await IssueApi.loadIssue({ issue_hash: story.issue_hash });
      if (issue?.project_hash) return issue.project_hash;
    } catch {
      // остаёмся на project_hash самого артефакта
    }
  }
  return story.project_hash ?? undefined;
}

/**
 * Адрес полной страницы артефакта — `…/requirements/<story_hash>` внутри
 * проекта или компонента-владельца. Ссылка постоянная: её можно переслать,
 * F5 открывает тот же артефакт на всю ширину рабочей области.
 *
 * Компонент от проекта отличает `parent_hash`, как в остальной навигации
 * Благороста; имя маршрута подстраивается под раздел стола
 * (кооперативные / мои проекты / компоненты) через capitalRouteName.
 * Владелец не найден — `null`, кнопку перехода вызывающий не показывает.
 */
export async function resolveStoryPageRoute(
  story: IStory,
  route: RouteLocationNormalizedLoaded,
): Promise<RouteLocationRaw | null> {
  const ownerHash = await resolveStoryOwnerProjectHash(story);
  if (!ownerHash) return null;
  const project = await useProjectStore().loadProject({ hash: ownerHash });
  const name = project?.parent_hash
    ? capitalRouteName('component-requirement-detail', route)
    : capitalRouteName('project-requirement-detail', route);
  return {
    name,
    params: { project_hash: ownerHash, story_hash: story.story_hash },
  };
}
