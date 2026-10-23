import { StoryStatus } from '../../domain/enums/story-status.enum';
import { StoryContentFormat } from '../../domain/enums/story-content-format.enum';
import { ProjectRecord } from './project.record';
import { IssueRecord } from './issue.record';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_stories';
export class StoryRecord extends ChainRecord {
  story_hash!: string;

  coopname!: string;

  title!: string;

  description?: string;

  content_format!: StoryContentFormat;

  status!: StoryStatus;

  project_hash?: string;

  issue_hash?: string;

  created_by!: string;

  sort_order!: number;

  /** Редакция содержимого (см. capital_content_revisions); 0 — снимков ещё нет. */
  content_rev!: number;

  matrix_requirement_announcement_events?: { matrix_room_id: string; event_id: string }[] | null;

  // Связи
  project!: ProjectRecord;

  issue!: IssueRecord;
}
