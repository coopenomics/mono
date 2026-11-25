import type { RouteLocationNormalizedLoaded, RouteLocationRaw, Router } from 'vue-router';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IStory } from 'app/extensions/capital/entities/Story/model';
import { capitalRouteName } from 'app/extensions/capital/shared/lib/capitalWorkspaceRoutes';
import { isComponent } from 'app/extensions/capital/shared/lib/project-utils';

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
 * Маршрут страницы артефакта в разделе, где пользователь сейчас стоит.
 *
 * Список артефактов проекта показывает и артефакты его компонентов и задач;
 * «Открыть» обязано оставить пользователя в том же проекте, а не уводить на
 * страницу компонента-владельца (замечание владельца 24.11.2026). Ветку
 * дерева (проект / компонент, раздел стола) даёт сам текущий маршрут:
 * у оболочки `X` (или `X-base`) страница артефакта называется
 * `X-requirement-detail`. Страница артефакта сама проверяет, что артефакт
 * лежит внутри этого проекта (по цепочке родителей).
 */
function contextDetailRouteName(route: RouteLocationNormalizedLoaded, router: Router): string | null {
  if (!route.params.project_hash) return null;
  for (const record of [...route.matched].reverse()) {
    const base = String(record.name ?? '').replace(/-base$/, '');
    if (!base) continue;
    const candidate = `${base}-requirement-detail`;
    if (router.hasRoute(candidate)) return candidate;
  }
  return null;
}

/**
 * Адрес полной страницы артефакта — `…/requirements/<story_hash>`. Ссылка
 * постоянная: её можно переслать, F5 открывает тот же артефакт.
 *
 * Внутри проекта или компонента — страница в этом же разделе. Из общего
 * списка артефактов — страница проекта или компонента-владельца; компонент
 * от проекта отличает `isComponent` (нулевой parent_hash — это проект).
 * Владелец не найден — `null`.
 */
export async function resolveStoryPageRoute(
  story: IStory,
  route: RouteLocationNormalizedLoaded,
  router: Router,
): Promise<RouteLocationRaw | null> {
  const contextName = contextDetailRouteName(route, router);
  if (contextName) {
    return {
      name: contextName,
      params: { project_hash: String(route.params.project_hash), story_hash: story.story_hash },
    };
  }

  const ownerHash = await resolveStoryOwnerProjectHash(story);
  if (!ownerHash) return null;
  const project = await useProjectStore().loadProject({ hash: ownerHash });
  const name = project && isComponent(project)
    ? capitalRouteName('component-requirement-detail', route)
    : capitalRouteName('project-requirement-detail', route);
  return {
    name,
    params: { project_hash: ownerHash, story_hash: story.story_hash },
  };
}
