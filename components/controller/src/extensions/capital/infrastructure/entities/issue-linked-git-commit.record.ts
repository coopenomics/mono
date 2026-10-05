
/**
 * Связь non-merge Git-коммита с задачей и пользователем кооператива (PRD FR7, эпик 2).
 * Строка — один ЛОГИЧЕСКИЙ коммит: переписанные воплощения того же изменения
 * (rebase/amend/cherry-pick) распознаются по `patch_id` и копятся SHA-алиасами
 * в `capital_issue_linked_git_commit_shas`, а не новыми строками — иначе одно
 * изменение вошло бы в РИД дважды. Один SHA на кооператив — идемпотентность (FR4).
 */
export const IssueLinkedGitCommitEntityName = 'capital_issue_linked_git_commits';

export class IssueLinkedGitCommitRecord {
  id!: string;

  coopname!: string;

  github_owner!: string;

  github_repo!: string;

  github_sha!: string;

  html_url!: string;

  issue_hash!: string;

  project_hash!: string;

  username!: string;

  commit_message!: string;

  git_author_login?: string | null;

  git_author_email?: string | null;

  committed_at!: Date;

  /** Склейка patch из GitHub API для вклада в RID / cooperative commit. */
  diff_text!: string;

  consumed_by_commit_hash!: string | null;

  /** Идентификатор содержимого правки (см. `computeGitPatchId`); для диффа без строк правок — SHA коммита. */
  patch_id!: string | null;

  /** Ветка, на которой коммит увиден впервые. */
  first_seen_branch!: string | null;

  /** Коммит достижим из базовой ветки синхронизации (канонической). */
  in_default_branch!: boolean;

  created_at!: Date;
}
