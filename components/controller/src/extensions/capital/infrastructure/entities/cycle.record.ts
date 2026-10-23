import { CycleStatus } from '../../domain/enums/cycle-status.enum';
import { IssueRecord } from './issue.record';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_cycles';
export class CycleRecord extends ChainRecord {
  name!: string;

  start_date!: Date;

  end_date!: Date;

  status!: CycleStatus;

  // Связи
  issues!: IssueRecord[];
}
