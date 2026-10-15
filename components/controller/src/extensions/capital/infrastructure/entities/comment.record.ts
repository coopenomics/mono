import { IssueRecord } from './issue.record';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_comments';
export class CommentRecord extends ChainRecord {
  content!: string;

  commentor_id!: string;

  issue_id!: string;

  reactions!: Record<string, string[]>;

  edited_at?: Date;

  // Связи
  issue!: IssueRecord;
}
