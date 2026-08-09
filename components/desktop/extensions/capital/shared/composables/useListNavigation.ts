import { useRouter, useRoute } from 'vue-router';

export function useListNavigation() {
  const router = useRouter();
  const route = useRoute();
  const isMyProjects = route.matched.some((r) => r.name === 'capital-my-projects');

  const navigateToProject = (projectHash: string) => {
    router.push({
      name: isMyProjects ? 'my-project-description' : 'project-description',
      params: { project_hash: projectHash }
    });
  };

  const navigateToComponent = (componentHash: string) => {
    router.push({
      name: isMyProjects ? 'my-component-description' : 'component-description',
      params: { project_hash: componentHash }
    });
  };

  return {
    navigateToProject,
    navigateToComponent
  };
}
