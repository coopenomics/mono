import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessInstanceTypeormEntity } from '../entities/process-instance.entity';
import type { ProcessInstanceRepository } from '../../domain/repositories/process.repository';
import type { ProcessInstanceDomainEntity } from '../../domain/entities/process-instance.entity';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';

@Injectable()
export class ProcessInstanceTypeormRepository implements ProcessInstanceRepository {
  constructor(
    @InjectRepository(ProcessInstanceTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    private readonly repo: Repository<ProcessInstanceTypeormEntity>,
  ) {}

  async create(data: Partial<ProcessInstanceDomainEntity>): Promise<ProcessInstanceDomainEntity> {
    const entity = this.repo.create(data as any);
    const saved = await this.repo.save(entity);
    return saved as unknown as ProcessInstanceDomainEntity;
  }

  async findById(id: string): Promise<ProcessInstanceDomainEntity | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity as unknown as ProcessInstanceDomainEntity | null;
  }

  async findByTemplateId(templateId: string): Promise<ProcessInstanceDomainEntity[]> {
    const entities = await this.repo.find({ where: { template_id: templateId }, order: { started_at: 'DESC' } });
    return entities as unknown as ProcessInstanceDomainEntity[];
  }

  async findByProjectHash(projectHash: string): Promise<ProcessInstanceDomainEntity[]> {
    const entities = await this.repo.find({ where: { project_hash: projectHash }, order: { started_at: 'DESC' } });
    return entities as unknown as ProcessInstanceDomainEntity[];
  }

  async update(id: string, data: Partial<ProcessInstanceDomainEntity>): Promise<ProcessInstanceDomainEntity> {
    await this.repo.update(id, data as any);
    return (await this.findById(id))!;
  }
}
