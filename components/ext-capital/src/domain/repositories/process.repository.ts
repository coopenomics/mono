import type { ProcessTemplateDomainEntity } from '../entities/process-template.entity';
import type { ProcessInstanceDomainEntity } from '../entities/process-instance.entity';

export interface ProcessTemplateRepository {
  create(template: Partial<ProcessTemplateDomainEntity>): Promise<ProcessTemplateDomainEntity>;
  findById(id: string): Promise<ProcessTemplateDomainEntity | null>;
  findByProjectHash(projectHash: string): Promise<ProcessTemplateDomainEntity[]>;
  findByCoopname(coopname: string): Promise<ProcessTemplateDomainEntity[]>;
  update(id: string, data: Partial<ProcessTemplateDomainEntity>): Promise<ProcessTemplateDomainEntity>;
  delete(id: string): Promise<void>;
}

export interface ProcessInstanceRepository {
  create(instance: Partial<ProcessInstanceDomainEntity>): Promise<ProcessInstanceDomainEntity>;
  findById(id: string): Promise<ProcessInstanceDomainEntity | null>;
  findByTemplateId(templateId: string): Promise<ProcessInstanceDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<ProcessInstanceDomainEntity[]>;
  update(id: string, data: Partial<ProcessInstanceDomainEntity>): Promise<ProcessInstanceDomainEntity>;
}

export const PROCESS_TEMPLATE_REPOSITORY = Symbol('ProcessTemplateRepository');
export const PROCESS_INSTANCE_REPOSITORY = Symbol('ProcessInstanceRepository');
