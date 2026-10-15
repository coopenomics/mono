import { IssueLinkedGitCommitRecord } from './issue-linked-git-commit.record';

/**
 * SHA-воплощение логического коммита. Один логический коммит (строка
 * `capital_issue_linked_git_commits`) обрастает несколькими SHA, когда историю
 * переписывают (rebase/amend) или изменение приходит cherry-pick'ом в другую
 * ветку. Уникальность SHA на кооператив гарантирует, что повторная встреча
 * любого воплощения — no-op, а не вторая строка в РИД.
 */
export const IssueLinkedGitCommitShaEntityName = 'capital_issue_linked_git_commit_shas';

export class IssueLinkedGitCommitShaRecord {
  id!: string;

  linked_commit_id!: string;

  linked_commit?: IssueLinkedGitCommitRecord;

  coopname!: string;

  github_sha!: string;

  /** Ветка, на которой это воплощение увидено. */
  seen_branch!: string | null;

  created_at!: Date;
}
