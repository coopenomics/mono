import { Zeus } from '@coopenomics/sdk';
import { api } from '../api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';

export function useUpdateProjectStatus() {
  const projectStore = useProjectStore();

  async function updateProjectStatus(
    projectHash: string,
    newStatus: Zeus.ProjectStatus,
    coopname: string
  ) {

    let updatedProject;

    // Вызываем соответствующую мутацию в зависимости от нового статуса
    switch (newStatus) {
      case Zeus.ProjectStatus.ACTIVE:
        updatedProject = await api.startProject({
          project_hash: projectHash,
          coopname,
        });
        break;

      case Zeus.ProjectStatus.PENDING:
        updatedProject = await api.stopProject({
          project_hash: projectHash,
          coopname,
        });
        break;

      case Zeus.ProjectStatus.VOTING:
        updatedProject = await api.startVoting({
          project_hash: projectHash,
          coopname,
        });
        break;

      case Zeus.ProjectStatus.RESULT:
        updatedProject = await api.completeVoting({
          project_hash: projectHash,
          coopname,
        });
        break;

      case Zeus.ProjectStatus.FINALIZED:
        updatedProject = await api.finalizeProject({
          project_hash: projectHash,
          coopname,
        });
        break;

      default:
        throw new Error(`Unsupported status transition to: ${newStatus}`);
    }

    // Обновляем проект в store
    if (updatedProject) {
      console.log('on updated? ', updatedProject)
      projectStore.addProjectToList(updatedProject);
    }

    return updatedProject;
  }

  return {
    updateProjectStatus,
  };
}
