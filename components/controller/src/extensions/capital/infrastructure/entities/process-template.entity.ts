import { ProcessTemplateStatus } from '../../domain/enums/process-status.enum';
import type { ProcessStepTemplate, ProcessEdge } from '../../domain/entities/process-template.entity';

export class ProcessTemplateTypeormEntity {
  id!: string;

  coopname!: string;

  project_hash!: string;

  title!: string;

  description?: string;

  status!: ProcessTemplateStatus;

  created_by!: string;

  steps!: ProcessStepTemplate[];

  edges!: ProcessEdge[];

  created_at!: Date;

  updated_at!: Date;
}
