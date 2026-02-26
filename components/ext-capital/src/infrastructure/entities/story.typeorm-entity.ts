import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { StoryStatus } from '../../domain/enums/story-status.enum';
import { ProjectTypeormEntity } from './project.typeorm-entity';
import { IssueTypeormEntity } from './issue.typeorm-entity';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_stories';
@Entity(EntityName)
@Index(`idx_${EntityName}_project_hash`, ['project_hash'])
@Index(`idx_${EntityName}_story_hash`, ['story_hash'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_issue_hash`, ['issue_hash'])
@Index(`idx_${EntityName}_created_by`, ['created_by'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class StoryTypeormEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  story_hash!: string;

  @Column({ type: 'varchar', length: 255 })
  coopname!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: StoryStatus,
    default: StoryStatus.PENDING,
  })
  status!: StoryStatus;

  @Column({ type: 'varchar', nullable: true })
  project_hash?: string;

  @Column({ type: 'varchar', nullable: true })
  issue_hash?: string;

  @Column({ type: 'varchar' })
  created_by!: string;

  @Column({ type: 'integer', default: 0 })
  sort_order!: number;

  // Связи
  @ManyToOne(() => ProjectTypeormEntity, (project) => project.stories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_hash', referencedColumnName: 'project_hash' })
  project!: ProjectTypeormEntity;

  @ManyToOne(() => IssueTypeormEntity, (issue) => issue.stories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_hash', referencedColumnName: 'issue_hash' })
  issue!: IssueTypeormEntity;
}
