import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationInputDTO, PaginationResult, PaginationUtils } from '@coopenomics/extension-kit';
import { SupportTicketMessageRepository } from '../../domain/repositories/support-ticket-message.repository';
import { SupportTicketMessageDomainEntity } from '../../domain/entities/support-ticket-message.entity';
import { SupportTicketMessageTypeormEntity } from '../entities/support-ticket-message.typeorm-entity';
import { SupportTicketMessageMapper } from '../mappers/support-ticket-message.mapper';

/**
 * Поля записи ленты, по которым разрешена сортировка.
 *
 * Список нужен и после возврата к `findAndCount`: TypeORM отвергает только
 * несуществующее свойство, а `body` и `authorUsername` — настоящие колонки, и
 * сортировка по ним прошла бы. Ограничение здесь про другое — лента
 * хронологическая, и упорядочивать её по тексту сообщения незачем.
 *
 * `authorUsername` не включён по той же причине: продуктовой ценности такая
 * сортировка не даёт. Прежнее обоснование ссылалось на обезличивание
 * оператора — оно отменено 25.08.2026 и к этому списку больше отношения не
 * имеет.
 */
const MESSAGE_SORT_FIELDS: ReadonlyArray<keyof SupportTicketMessageDomainEntity> = [
  'authorRole',
  'systemEvent',
  'createdAt',
];

@Injectable()
export class SupportTicketMessageTypeormRepository implements SupportTicketMessageRepository {
  constructor(
    @InjectRepository(SupportTicketMessageTypeormEntity)
    private readonly repository: Repository<SupportTicketMessageTypeormEntity>
  ) {}

  // Пишет только запись ленты. Обновление ticket.lastMessageAt на каждую
  // запись — включая системные (например, автозакрытие) — не входит в этот
  // метод и не может быть выведено из него: связку "append сюда + update
  // ticket.lastMessageAt" обязан держать вызывающий сервисный слой на каждом
  // пути, который сюда пишет.
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

    if (validated.sortBy && !MESSAGE_SORT_FIELDS.includes(validated.sortBy as keyof SupportTicketMessageDomainEntity)) {
      throw new Error(
        `Сортировка ленты по полю "${validated.sortBy}" не поддерживается. Допустимые поля: ${MESSAGE_SORT_FIELDS.join(', ')}`
      );
    }

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

  async countByTicketIds(ticketIds: string[]): Promise<Map<string, number>> {
    // Пустой список — пустой ответ без похода в базу: `IN ()` в SQL не бывает,
    // а TypeORM на пустом `In([])` строит условие, которое незачем выполнять.
    if (ticketIds.length === 0) return new Map();

    const rows = await this.repository
      .createQueryBuilder('message')
      .select('message.ticketId', 'ticketId')
      .addSelect('COUNT(*)', 'count')
      .where('message.ticketId IN (:...ticketIds)', { ticketIds })
      .groupBy('message.ticketId')
      .getRawMany<{ ticketId: string; count: string }>();

    // COUNT приходит строкой, приведение обязательно.
    return new Map(rows.map((row) => [row.ticketId, Number(row.count)]));
  }
}
