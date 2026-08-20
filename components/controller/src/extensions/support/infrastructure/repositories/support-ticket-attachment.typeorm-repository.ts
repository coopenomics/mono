import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationInputDTO, PaginationResult, PaginationUtils } from '@coopenomics/extension-kit';
import { SupportTicketAttachmentRepository } from '../../domain/repositories/support-ticket-attachment.repository';
import { SupportTicketAttachmentDomainEntity } from '../../domain/entities/support-ticket-attachment.entity';
import { SupportTicketAttachmentTypeormEntity } from '../entities/support-ticket-attachment.typeorm-entity';
import { SupportTicketAttachmentMapper } from '../mappers/support-ticket-attachment.mapper';

@Injectable()
export class SupportTicketAttachmentTypeormRepository implements SupportTicketAttachmentRepository {
  constructor(
    @InjectRepository(SupportTicketAttachmentTypeormEntity)
    private readonly repository: Repository<SupportTicketAttachmentTypeormEntity>
  ) {}

  async create(
    data: Omit<SupportTicketAttachmentDomainEntity, 'id' | 'uploadedAt'>
  ): Promise<SupportTicketAttachmentDomainEntity> {
    const entity = this.repository.create(SupportTicketAttachmentMapper.toEntity(data));
    const saved = await this.repository.save(entity);
    return SupportTicketAttachmentMapper.toDomain(saved);
  }

  async findById(id: string): Promise<SupportTicketAttachmentDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? SupportTicketAttachmentMapper.toDomain(entity) : null;
  }

  async findByMessageId(messageId: string): Promise<SupportTicketAttachmentDomainEntity[]> {
    const entities = await this.repository.find({ where: { messageId }, order: { uploadedAt: 'ASC' } });
    return entities.map(SupportTicketAttachmentMapper.toDomain);
  }

  async findByTicketId(
    ticketId: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketAttachmentDomainEntity>> {
    const validated = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortOrder: 'ASC' as const };
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validated);
    const order = validated.sortBy ? { [validated.sortBy]: validated.sortOrder } : { uploadedAt: 'DESC' as const };

    const [entities, total] = await this.repository.findAndCount({
      where: { ticketId },
      order,
      take: limit,
      skip: offset,
    });

    return PaginationUtils.createPaginationResult(
      entities.map(SupportTicketAttachmentMapper.toDomain),
      total,
      validated
    );
  }

  async findByTicketAndChecksum(
    ticketId: string,
    checksumSha256: string
  ): Promise<SupportTicketAttachmentDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { ticketId, checksumSha256 } });
    return entity ? SupportTicketAttachmentMapper.toDomain(entity) : null;
  }
}
