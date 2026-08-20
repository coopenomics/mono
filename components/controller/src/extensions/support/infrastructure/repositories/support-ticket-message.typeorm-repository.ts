import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationInputDTO, PaginationResult, PaginationUtils } from '@coopenomics/extension-kit';
import { SupportTicketMessageRepository } from '../../domain/repositories/support-ticket-message.repository';
import { SupportTicketMessageDomainEntity } from '../../domain/entities/support-ticket-message.entity';
import { SupportTicketMessageTypeormEntity } from '../entities/support-ticket-message.typeorm-entity';
import { SupportTicketMessageMapper } from '../mappers/support-ticket-message.mapper';

@Injectable()
export class SupportTicketMessageTypeormRepository implements SupportTicketMessageRepository {
  constructor(
    @InjectRepository(SupportTicketMessageTypeormEntity)
    private readonly repository: Repository<SupportTicketMessageTypeormEntity>
  ) {}

  async append(
    data: Omit<SupportTicketMessageDomainEntity, 'id' | 'createdAt'>
  ): Promise<SupportTicketMessageDomainEntity> {
    const entity = this.repository.create(SupportTicketMessageMapper.toEntity(data));
    const saved = await this.repository.save(entity);
    return SupportTicketMessageMapper.toDomain(saved);
  }

  async findById(id: string): Promise<SupportTicketMessageDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? SupportTicketMessageMapper.toDomain(entity) : null;
  }

  async findByTicketId(
    ticketId: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketMessageDomainEntity>> {
    const validated = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortOrder: 'ASC' as const };
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validated);
    const order = validated.sortBy ? { [validated.sortBy]: validated.sortOrder } : { createdAt: 'ASC' as const };

    const [entities, total] = await this.repository.findAndCount({
      where: { ticketId },
      order,
      take: limit,
      skip: offset,
    });

    return PaginationUtils.createPaginationResult(entities.map(SupportTicketMessageMapper.toDomain), total, validated);
  }
}
