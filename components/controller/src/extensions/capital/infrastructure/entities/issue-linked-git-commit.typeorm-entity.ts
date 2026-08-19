import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * Связь non-merge Git-коммита с задачей и пользователем кооператива (PRD FR7, эпик 2).
 * Строка — один ЛОГИЧЕСКИЙ коммит: переписанные воплощения того же изменения
 * (rebase/amend/cherry-pick) распознаются по `patch_id` и копятся SHA-алиасами
 * в `capital_issue_linked_git_commit_shas`, а не новыми строками — иначе одно
 * изменение вошло бы в РИД дважды. Один SHA на кооператив — идемпотентность (FR4).
 */
export const IssueLinkedGitCommitEntityName = 'capital_issue_linked_git_commits';

@Entity(IssueLinkedGitCommitEntityName)
@Index(`idx_${IssueLinkedGitCommitEntityName}_coop_sha`, ['coopname', 'github_sha'], { unique: true })
@Index(`idx_${IssueLinkedGitCommitEntityName}_project_user_open`, [
  'coopname',
  'project_hash',
  'username',
  'consumed_by_commit_hash',
])
@Index(`idx_${IssueLinkedGitCommitEntityName}_patch_identity`, [
  'coopname',
  'github_owner',
  'github_repo',
  'issue_hash',
  'patch_id',
])
export class IssueLinkedGitCommitTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  coopname!: string;

  @Column({ type: 'varchar', length: 255 })
  github_owner!: string;

  @Column({ type: 'varchar', length: 255 })
  github_repo!: string;

  @Column({ type: 'varchar', length: 40 })
  github_sha!: string;

  @Column({ type: 'text' })
  html_url!: string;

  @Column({ type: 'varchar', length: 64 })
  issue_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  project_hash!: string;

  @Column({ type: 'varchar', length: 255 })
  username!: string;

  @Column({ type: 'text' })
  commit_message!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  git_author_login?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  git_author_email?: string | null;

  @Column({ type: 'timestamptz' })
  committed_at!: Date;

  /** Склейка patch из GitHub API для вклада в RID / cooperative commit. */
  @Column({ type: 'text' })
  diff_text!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  consumed_by_commit_hash!: string | null;

  /** Идентификатор содержимого правки (см. `computeGitPatchId`); для диффа без строк правок — SHA коммита. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  patch_id!: string | null;

  /** Ветка, на которой коммит увиден впервые. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  first_seen_branch!: string | null;

  /** Коммит достижим из базовой ветки синхронизации (канонической). */
  @Column({ type: 'boolean', default: false })
  in_default_branch!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
