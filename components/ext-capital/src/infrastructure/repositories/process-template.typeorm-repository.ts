import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessTemplateTypeormEntity } from '../entities/process-template.entity';
import type { ProcessTemplateRepository } from '../../domain/repositories/process.repository';
import type { ProcessTemplateDomainEntity } from '../../domain/entities/process-template.entity';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';

@Injectable()
export class ProcessTemplateTypeormRepository implements ProcessTemplateRepository {
  constructor(
    @InjectRepository(ProcessTemplateTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    private readonly repo: Repository<ProcessTemplateTypeormEntity>,
  ) {}

  async create(data: Partial<ProcessTemplateDomainEntity>): Promise<ProcessTemplateDomainEntity> {
    const entity = this.repo.create(data as any);
    const saved = await this.repo.save(entity);
    return saved as unknown as ProcessTemplateDomainEntity;
  }

  async findById(id: string): Promise<ProcessTemplateDomainEntity | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity as unknown as ProcessTemplateDomainEntity | null;
  }

  async findByProjectHash(projectHash: string): Promise<ProcessTemplateDomainEntity[]> {
    const entities = await this.repo.find({ where: { project_hash: projectHash } });
    return entities as unknown as ProcessTemplateDomainEntity[];
  }

  async findByCoopname(coopname: string): Promise<ProcessTemplateDomainEntity[]> {
    const entities = await this.repo.find({ where: { coopname }, order: { created_at: 'DESC' } });
    return entities as unknown as ProcessTemplateDomainEntity[];
  }

  async update(id: string, data: Partial<ProcessTemplateDomainEntity>): Promise<ProcessTemplateDomainEntity> {
    await this.repo.update(id, data as any);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
