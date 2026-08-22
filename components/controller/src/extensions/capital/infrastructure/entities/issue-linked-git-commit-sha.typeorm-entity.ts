import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { IssueLinkedGitCommitTypeormEntity } from './issue-linked-git-commit.typeorm-entity';

/**
 * SHA-воплощение логического коммита. Один логический коммит (строка
 * `capital_issue_linked_git_commits`) обрастает несколькими SHA, когда историю
 * переписывают (rebase/amend) или изменение приходит cherry-pick'ом в другую
 * ветку. Уникальность SHA на кооператив гарантирует, что повторная встреча
 * любого воплощения — no-op, а не вторая строка в РИД.
 */
export const IssueLinkedGitCommitShaEntityName = 'capital_issue_linked_git_commit_shas';

@Entity(IssueLinkedGitCommitShaEntityName)
@Index(`idx_${IssueLinkedGitCommitShaEntityName}_coop_sha`, ['coopname', 'github_sha'], { unique: true })
@Index(`idx_${IssueLinkedGitCommitShaEntityName}_linked`, ['linked_commit_id'])
export class IssueLinkedGitCommitShaTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  linked_commit_id!: string;

  @ManyToOne(() => IssueLinkedGitCommitTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'linked_commit_id' })
  linked_commit?: IssueLinkedGitCommitTypeormEntity;

  @Column({ type: 'varchar', length: 255 })
  coopname!: string;

  @Column({ type: 'varchar', length: 40 })
  github_sha!: string;

  /** Ветка, на которой это воплощение увидено. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  seen_branch!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
