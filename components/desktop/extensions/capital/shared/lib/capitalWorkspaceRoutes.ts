import { computed } from 'vue';
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router';

/** Находимся ли в дереве «Мои проекты» (рейл / nested routes). */
export function isMyProjectsWorkspace(
  route: RouteLocationNormalizedLoaded,
): boolean {
  return route.matched.some((r) => r.name === 'capital-my-projects');
}

/**
 * Имя маршрута кооперативного дерева → имя в дереве «Мои проекты».
 * project-description → my-project-description
 * component-tasks → my-component-tasks
 * component-issue-description → my-component-issue-description
 */
export function capitalRouteName(
  coopRouteName: string,
  route: RouteLocationNormalizedLoaded,
): string {
  if (!isMyProjectsWorkspace(route)) return coopRouteName;
  if (coopRouteName.startsWith('component-issue')) {
    return coopRouteName.replace(/^component-issue/, 'my-component-issue');
  }
  if (coopRouteName.startsWith('component')) {
    return coopRouteName.replace(/^component/, 'my-component');
  }
  if (coopRouteName.startsWith('project')) {
    return coopRouteName.replace(/^project/, 'my-project');
  }
  return coopRouteName;
}

export function useCapitalWorkspaceRoutes() {
  const route = useRoute();
  const isMyProjects = computed(() => isMyProjectsWorkspace(route));
  const listRoute = computed(() =>
    isMyProjects.value ? 'capital-my-projects' : 'projects-list',
  );
  const routeName = (coopRouteName: string) =>
    capitalRouteName(coopRouteName, route);

  return { isMyProjects, listRoute, routeName };
}
