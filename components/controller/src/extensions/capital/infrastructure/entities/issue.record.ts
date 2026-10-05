import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { ProjectRecord } from './project.record';
import { CycleRecord } from './cycle.record';
import { CommentRecord } from './comment.record';
import { StoryRecord } from './story.record';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_issues';
export class IssueRecord extends ChainRecord {
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
  project?: ProjectRecord | null;

  cycle!: CycleRecord;

  comments!: CommentRecord[];

  stories!: StoryRecord[];
}
