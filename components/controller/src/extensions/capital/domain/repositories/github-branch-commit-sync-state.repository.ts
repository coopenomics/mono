export interface GithubBranchCommitSyncStateRepository {
  getState(coopname: string, githubRepository: string, branch: string): Promise<{ last_synced_tip_sha: string | null } | null>;
  setTipSha(coopname: string, githubRepository: string, branch: string, tipSha: string | null): Promise<void>;
  /** Удалить курсор синхронизации (репозиторий снят со всех проектов и т.п.). */
  deleteState(coopname: string, githubRepository: string, branch: string): Promise<void>;
  /** Ветки, по которым заведены курсоры (для чистки курсоров удалённых веток). */
  listBranches(coopname: string, githubRepository: string): Promise<string[]>;
}

export const GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY = Symbol('GithubBranchCommitSyncStateRepository');
