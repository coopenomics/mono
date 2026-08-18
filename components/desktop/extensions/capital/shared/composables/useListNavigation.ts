import { useRouter, useRoute } from 'vue-router';

export function useListNavigation() {
  const router = useRouter();
  const route = useRoute();
  const isMyProjects = route.matched.some((r) => r.name === 'capital-my-projects');

  /**
   * Возврат — на страницу, откуда пришли, а не на проект-родитель.
   * Без этой пометки кнопка «назад» у компонента ведёт вверх по дереву, и
   * список, из которого открыли компонент, теряется вместе с его состоянием.
   */
  const backToList = { _useHistoryBack: 'true' };

  const navigateToProject = (projectHash: string) => {
    router.push({
      name: isMyProjects ? 'my-project-description' : 'project-description',
      params: { project_hash: projectHash },
      query: backToList,
    });
  };

  const navigateToComponent = (componentHash: string) => {
    router.push({
      name: isMyProjects ? 'my-component-description' : 'component-description',
      params: { project_hash: componentHash },
      query: backToList,
    });
  };

  return {
    navigateToProject,
    navigateToComponent
  };
}
