import { computed } from 'vue';
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router';

/** Дерево, в котором сейчас находится пользователь. */
export type CapitalWorkspace = 'coop' | 'my' | 'components';

/** Находимся ли в дереве «Мои проекты» (рейл / nested routes). */
export function isMyProjectsWorkspace(
  route: RouteLocationNormalizedLoaded,
): boolean {
  return route.matched.some((r) => r.name === 'capital-my-projects');
}

/** Находимся ли в разделе «Компоненты» (плоский список компонентов). */
export function isComponentsWorkspace(
  route: RouteLocationNormalizedLoaded,
): boolean {
  return route.matched.some((r) => r.name === 'components-list');
}

export function capitalWorkspace(
  route: RouteLocationNormalizedLoaded,
): CapitalWorkspace {
  if (isMyProjectsWorkspace(route)) return 'my';
  if (isComponentsWorkspace(route)) return 'components';
  return 'coop';
}

/**
 * Имя маршрута кооперативного дерева → имя в текущем дереве.
 * project-description → my-project-description
 * component-tasks → my-component-tasks / cmp-component-tasks
 * component-issue-description → my-component-issue-description / cmp-component-issue-description
 *
 * В разделе «Компоненты» проекта нет — маршруты проекта остаются
 * кооперативными, по ним пользователь уходит в мастерскую.
 */
export function capitalRouteName(
  coopRouteName: string,
  route: RouteLocationNormalizedLoaded,
): string {
  const workspace = capitalWorkspace(route);
  if (workspace === 'coop') return coopRouteName;

  const prefix = workspace === 'my' ? 'my' : 'cmp';

  if (coopRouteName.startsWith('component-issue')) {
    return coopRouteName.replace(/^component-issue/, `${prefix}-component-issue`);
  }
  if (coopRouteName.startsWith('component')) {
    return coopRouteName.replace(/^component/, `${prefix}-component`);
  }
  if (workspace === 'my' && coopRouteName.startsWith('project')) {
    return coopRouteName.replace(/^project/, 'my-project');
  }
  return coopRouteName;
}

export function useCapitalWorkspaceRoutes() {
  const route = useRoute();
  const isMyProjects = computed(() => isMyProjectsWorkspace(route));
  const isComponents = computed(() => isComponentsWorkspace(route));
  const listRoute = computed(() => {
    if (isMyProjects.value) return 'capital-my-projects';
    if (isComponents.value) return 'components-list';
    return 'projects-list';
  });
  const routeName = (coopRouteName: string) =>
    capitalRouteName(coopRouteName, route);

  return { isMyProjects, isComponents, listRoute, routeName };
}
