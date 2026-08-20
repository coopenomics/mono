import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { PaginationInputDTO, PaginationResult, PaginationUtils } from '@coopenomics/extension-kit';
import { SupportTicketRepository } from '../../domain/repositories/support-ticket.repository';
import { SupportTicketDomainEntity } from '../../domain/entities/support-ticket.entity';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';
import { SupportTicketTypeormEntity } from '../entities/support-ticket.typeorm-entity';
import { SupportTicketMapper } from '../mappers/support-ticket.mapper';

@Injectable()
export class SupportTicketTypeormRepository implements SupportTicketRepository {
  constructor(
    @InjectRepository(SupportTicketTypeormEntity)
    private readonly repository: Repository<SupportTicketTypeormEntity>
  ) {}

  async create(
    data: Omit<SupportTicketDomainEntity, 'id' | 'number' | 'createdAt' | 'updatedAt'>
  ): Promise<SupportTicketDomainEntity> {
    const entity = this.repository.create(SupportTicketMapper.toEntity(data));
    const saved = await this.repository.save(entity);
    return SupportTicketMapper.toDomain(saved);
  }

  async findById(id: string): Promise<SupportTicketDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? SupportTicketMapper.toDomain(entity) : null;
  }

  async findByNumber(number: string): Promise<SupportTicketDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { number } });
    return entity ? SupportTicketMapper.toDomain(entity) : null;
  }

  async findByStatuses(
    statuses: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated({ status: In(statuses) }, { lastMessageAt: 'DESC' }, options);
  }

  async findByAuthor(
    authorUsername: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated({ authorUsername }, { createdAt: 'DESC' }, options);
  }

  async findByAssignee(
    assigneeUsername: string,
    statuses?: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated(
      { assigneeUsername, ...(statuses ? { status: In(statuses) } : {}) },
      { createdAt: 'DESC' },
      options
    );
  }

  async findByKind(
    kind: SupportTicketKind,
    statuses?: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated(
      { kind, ...(statuses ? { status: In(statuses) } : {}) },
      { createdAt: 'DESC' },
      options
    );
  }

  async findResolvedBefore(cutoff: Date): Promise<SupportTicketDomainEntity[]> {
    const entities = await this.repository.find({
      where: { status: SupportTicketStatus.RESOLVED, resolvedAt: LessThanOrEqual(cutoff) },
    });
    return entities.map(SupportTicketMapper.toDomain);
  }

  async findEscalated(options?: PaginationInputDTO): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated({ escalatedAt: Not(IsNull()) }, { escalatedAt: 'DESC' }, options);
  }

  async update(
    id: string,
    changes: Partial<
      Omit<SupportTicketDomainEntity, 'id' | 'number' | 'coopname' | 'authorUsername' | 'createdAt'>
    >
  ): Promise<SupportTicketDomainEntity> {
    // Свойства домена и TypeORM-сущности совпадают 1:1 (camelCase), поэтому
    // партиал передаётся как есть — прогон через toEntity() затронул бы и
    // не указанные вызывающим поля, подставив им undefined.
    await this.repository.update({ id }, changes as Partial<SupportTicketTypeormEntity>);
    const updated = await this.repository.findOne({ where: { id } });
    if (!updated) throw new Error(`Обращение ${id} не найдено после обновления`);
    return SupportTicketMapper.toDomain(updated);
  }

  private async findPaginated(
    where: Record<string, unknown>,
    defaultOrder: Record<string, 'ASC' | 'DESC'>,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    const validated = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortOrder: 'ASC' as const };
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validated);
    const order = validated.sortBy ? { [validated.sortBy]: validated.sortOrder } : defaultOrder;

    const [entities, total] = await this.repository.findAndCount({
      where,
      order,
      take: limit,
      skip: offset,
    });

    return PaginationUtils.createPaginationResult(entities.map(SupportTicketMapper.toDomain), total, validated);
  }
}
