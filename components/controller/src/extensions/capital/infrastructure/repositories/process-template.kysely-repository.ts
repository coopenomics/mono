import { TableStore } from '@coopenomics/extension-kit';
import { CAPITAL_PROCESS_TEMPLATE_STORE } from '../../infrastructure/database/capital-stores';
import { Inject, Injectable } from '@nestjs/common';
import { ProcessTemplateRecord } from '../entities/process-template.entity';
import type { ProcessTemplateRepository } from '../../domain/repositories/process.repository';
import type { ProcessTemplateDomainEntity } from '../../domain/entities/process-template.entity';

@Injectable()
export class ProcessTemplateKyselyRepository implements ProcessTemplateRepository {
  constructor(
    @Inject(CAPITAL_PROCESS_TEMPLATE_STORE)
    private readonly repo: TableStore<ProcessTemplateRecord>,
  ) {}

  async create(data: Partial<ProcessTemplateDomainEntity>): Promise<ProcessTemplateDomainEntity> {
    const entity = this.repo.create(data as any);
    const saved = await this.repo.save(entity);
    return saved as unknown as ProcessTemplateDomainEntity;
  }

  async findById(id: string): Promise<ProcessTemplateDomainEntity | null> {
    const entity = await this.repo.findOne({ id });
    return entity as unknown as ProcessTemplateDomainEntity | null;
  }

  async findByProjectHash(projectHash: string): Promise<ProcessTemplateDomainEntity[]> {
    const entities = await this.repo.find({ project_hash: projectHash });
    return entities as unknown as ProcessTemplateDomainEntity[];
  }

  async findByCoopname(coopname: string): Promise<ProcessTemplateDomainEntity[]> {
    const entities = await this.repo.find({ coopname }, { order: { created_at: 'DESC' } });
    return entities as unknown as ProcessTemplateDomainEntity[];
  }

  async update(id: string, data: Partial<ProcessTemplateDomainEntity>): Promise<ProcessTemplateDomainEntity> {
    await this.repo.update({ id }, data as any);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
