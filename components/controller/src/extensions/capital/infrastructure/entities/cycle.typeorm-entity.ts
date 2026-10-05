import { CycleStatus } from '../../domain/enums/cycle-status.enum';
import { IssueTypeormEntity } from './issue.typeorm-entity';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_cycles';
export class CycleTypeormEntity extends ChainRecord {
  name!: string;

  start_date!: Date;

  end_date!: Date;

  status!: CycleStatus;

  // Связи
  issues!: IssueTypeormEntity[];
}
