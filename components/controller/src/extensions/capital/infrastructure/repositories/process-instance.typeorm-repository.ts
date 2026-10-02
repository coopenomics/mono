import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessInstanceTypeormEntity } from '../entities/process-instance.entity';
import type { ProcessInstanceRepository } from '../../domain/repositories/process.repository';
import type { ProcessInstanceDomainEntity } from '../../domain/entities/process-instance.entity';

/**
 * Состояния шагов лежат в jsonb, и время закрытия шага возвращается из базы
 * строкой — домен и API ждут дату.
 */
function toDomain(entity: ProcessInstanceTypeormEntity): ProcessInstanceDomainEntity {
  return {
    ...entity,
    step_states: (entity.step_states ?? []).map((state) => ({
      ...state,
      completed_at: state.completed_at ? new Date(state.completed_at) : undefined,
    })),
  } as ProcessInstanceDomainEntity;
}

@Injectable()
export class ProcessInstanceTypeormRepository implements ProcessInstanceRepository {
  constructor(
    @InjectRepository(ProcessInstanceTypeormEntity)
    private readonly repo: Repository<ProcessInstanceTypeormEntity>,
  ) {}

  async create(data: Partial<ProcessInstanceDomainEntity>): Promise<ProcessInstanceDomainEntity> {
    const entity = this.repo.create(data as any);
    const saved = (await this.repo.save(entity)) as unknown as ProcessInstanceTypeormEntity;
    return toDomain(saved);
  }

  async findById(id: string): Promise<ProcessInstanceDomainEntity | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? toDomain(entity) : null;
  }

  async findByTemplateId(templateId: string): Promise<ProcessInstanceDomainEntity[]> {
    const entities = await this.repo.find({ where: { template_id: templateId }, order: { started_at: 'DESC' } });
    return entities.map(toDomain);
  }

  async findByProjectHash(projectHash: string): Promise<ProcessInstanceDomainEntity[]> {
    const entities = await this.repo.find({ where: { project_hash: projectHash }, order: { started_at: 'DESC' } });
    return entities.map(toDomain);
  }

  async update(id: string, data: Partial<ProcessInstanceDomainEntity>): Promise<ProcessInstanceDomainEntity> {
    await this.repo.update(id, data as any);
    return (await this.findById(id))!;
  }
}
