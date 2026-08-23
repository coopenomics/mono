import {
  useIssueStore,
  type IDeleteIssueInput,
  type IDeleteIssueOutput,
} from 'app/extensions/capital/entities/Issue/model';
import { useFavoritesStore } from 'app/extensions/capital/entities/Favorite';
import { api } from '../api';

export function useDeleteIssue() {
  const store = useIssueStore();
  const favoritesStore = useFavoritesStore();

  async function deleteIssue(
    data: IDeleteIssueInput,
    projectHash: string,
  ): Promise<IDeleteIssueOutput> {
    const result = await api.deleteIssue(data);

    if (result) {
      store.removeIssue(projectHash, data.issue_hash);
      favoritesStore.dropTarget(data.issue_hash);
    }

    return result;
  }

  return { deleteIssue };
}
