import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { ProjectTypeormEntity } from './project.typeorm-entity';
import { CycleTypeormEntity } from './cycle.typeorm-entity';
import { CommentTypeormEntity } from './comment.typeorm-entity';
import { StoryTypeormEntity } from './story.typeorm-entity';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_issues';
export class IssueTypeormEntity extends ChainRecord {
  id!: string;

  issue_hash!: string;

  coopname!: string;

  title!: string;

  description?: string;

  priority!: IssuePriority;

  status!: IssueStatus;

  estimate!: number;

  sort_order!: number;

  /** Редакция содержимого (см. capital_content_revisions); 0 — снимков ещё нет. */
  content_rev!: number;

  created_by!: string;

  creators!: string[];

  submaster?: string;

  /** NULL — свободная задача без проекта/компонента */
  project_hash?: string | null;

  cycle_id?: string;

  metadata!: {
    labels: string[];
    attachments: string[];
  };

  // Связи
  project?: ProjectTypeormEntity | null;

  cycle!: CycleTypeormEntity;

  comments!: CommentTypeormEntity[];

  stories!: StoryTypeormEntity[];
}
