
/** Курсор tip ветки для инкрементального сравнения коммитов (PRD NFR1, story 1.2). */
export const GithubBranchCommitSyncStateEntityName = 'capital_github_branch_commit_sync_state';

export class GithubBranchCommitSyncStateTypeormEntity {
  id!: string;

  coopname!: string;

  /** Нормализованный URL репозитория (или legacy owner/repo) — ключ курсора NFR1. */
  github_repository!: string;

  branch!: string;

  /** Последний обработанный tip ветки (для compare base); null — «холодный старт», берём текущий HEAD без backfill. */
  last_synced_tip_sha!: string | null;

  updated_at!: Date;
}
