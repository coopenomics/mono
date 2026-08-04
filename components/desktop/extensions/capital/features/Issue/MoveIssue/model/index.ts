import { useIssueStore } from 'app/extensions/capital/entities/Issue/model';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';
import { api, type IMoveIssueToComponentInput } from '../api';

export function useMoveIssueToComponent() {
  const store = useIssueStore();

  async function moveIssue(
    data: IMoveIssueToComponentInput,
    fromProjectHash?: string | null,
  ): Promise<IIssue> {
    const updated = await api.moveIssueToComponent(data);
    store.relocateIssue(
      fromProjectHash?.trim() || '',
      data.target_project_hash.toLowerCase(),
      updated,
    );
    return updated;
  }

  return { moveIssue };
}
