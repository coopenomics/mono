export interface IssueLinkedGitCommitRow {
  id: string;
  coopname: string;
  github_owner: string;
  github_repo: string;
  github_sha: string;
  html_url: string;
  issue_hash: string;
  project_hash: string;
  username: string;
  commit_message: string;
  git_author_login: string | null;
  git_author_email: string | null;
  committed_at: Date;
  diff_text: string;
  consumed_by_commit_hash: string | null;
  patch_id: string | null;
  first_seen_branch: string | null;
  in_default_branch: boolean;
}

export interface IssueLinkedGitCommitRepository {
  /**
   * Создать логический коммит вместе с alias-записью его SHA.
   * Повторная вставка того же SHA молча игнорируется (идемпотентность, FR4).
   */
  insertLinkedCommit(
    row: Omit<IssueLinkedGitCommitRow, 'id' | 'consumed_by_commit_hash'>
  ): Promise<void>;
  /** Найти логический коммит по любому его SHA-воплощению (канон или алиас). */
  findByAnySha(coopname: string, githubSha: string): Promise<IssueLinkedGitCommitRow | null>;
  /** Найти логический коммит по идентичности правки — так распознаются rebase/amend/cherry-pick. */
  findByPatchIdentity(args: {
    coopname: string;
    githubOwner: string;
    githubRepo: string;
    issueHash: string;
    patchId: string;
  }): Promise<IssueLinkedGitCommitRow | null>;
  /** Зарегистрировать ещё одно SHA-воплощение логического коммита (повтор SHA — no-op). */
  registerShaAlias(args: {
    linkedCommitId: string;
    coopname: string;
    githubSha: string;
    seenBranch: string | null;
  }): Promise<void>;
  /**
   * Пометить коммит достижимым из базовой ветки и сделать это воплощение каноническим
   * (`github_sha`/`html_url` строки указывают на версию из базовой ветки).
   */
  promoteToDefaultBranch(args: {
    linkedCommitId: string;
    canonicalSha: string;
    canonicalHtmlUrl: string;
  }): Promise<void>;
  /** Строки без patch_id (дозаполнение после обновления схемы). */
  findRowsWithoutPatchId(limit: number): Promise<IssueLinkedGitCommitRow[]>;
  /** Дозаполнить идентичность правки и первую ветку у существующей строки. */
  backfillPatchIdentity(args: {
    id: string;
    patchId: string;
    firstSeenBranch: string | null;
    inDefaultBranch: boolean;
  }): Promise<void>;
  findUnconsumedByProjectAndUsername(projectHash: string, username: string): Promise<IssueLinkedGitCommitRow[]>;
  /** Все привязанные коммиты по задаче (аудит / UI задачи). */
  findByIssueHash(issueHash: string): Promise<IssueLinkedGitCommitRow[]>;
  /** Привязки по нескольким задачам (один запрос; группировка по `issue_hash` — на стороне вызывающего). */
  findByIssueHashes(issueHashes: string[]): Promise<IssueLinkedGitCommitRow[]>;
  markConsumed(ids: string[], commitHash: string): Promise<void>;

  /** Есть ли привязанные Git-коммиты, уже упакованные в коммит CAPITAL (consumed) */
  hasConsumedRowsByIssueHash(issueHash: string): Promise<boolean>;

  /** Обновить project_hash у привязок Git по задаче */
  updateProjectHashByIssueHash(issueHash: string, projectHash: string): Promise<void>;
}

export const ISSUE_LINKED_GIT_COMMIT_REPOSITORY = Symbol('IssueLinkedGitCommitRepository');
