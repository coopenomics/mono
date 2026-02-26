import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { IssueTypeormEntity } from './issue.typeorm-entity';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_comments';
@Entity(EntityName)
@Index(`idx_${EntityName}_commentor_id`, ['commentor_id'])
@Index(`idx_${EntityName}_issue_id`, ['issue_id'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class CommentTypeormEntity extends BaseTypeormEntity {
  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar' })
  commentor_id!: string;

  @Column({ type: 'varchar' })
  issue_id!: string;

  @Column({ type: 'json', default: {} })
  reactions!: Record<string, string[]>;

  @Column({ type: 'timestamp', nullable: true })
  edited_at?: Date;

  // Связи
  @ManyToOne(() => IssueTypeormEntity, (issue) => issue.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue!: IssueTypeormEntity;
}
