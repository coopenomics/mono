import { ProcessInstanceStatus } from '../../domain/enums/process-status.enum';
import type { ProcessStepState } from '../../domain/entities/process-instance.entity';

export class ProcessInstanceTypeormEntity {
  id!: string;

  coopname!: string;

  template_id!: string;

  project_hash!: string;

  status!: ProcessInstanceStatus;

  started_by!: string;

  cycle!: number;

  step_states!: ProcessStepState[];

  started_at!: Date;

  completed_at?: Date;
}
