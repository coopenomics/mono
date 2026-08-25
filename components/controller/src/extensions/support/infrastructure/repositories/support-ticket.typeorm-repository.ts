import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { PaginationInputDTO, PaginationResult, PaginationUtils } from '@coopenomics/extension-kit';
import {
  SupportTicketRepository,
  type SupportLedgerEntryDraft,
  type SupportMemberTicketFilter,
  type SupportTicketChanges,
  type SupportTicketFilter,
} from '../../domain/repositories/support-ticket.repository';
import { SupportTicketDomainEntity } from '../../domain/entities/support-ticket.entity';
import { SupportTicketMessageDomainEntity } from '../../domain/entities/support-ticket-message.entity';
import { SupportTicketAttachmentDomainEntity } from '../../domain/entities/support-ticket-attachment.entity';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';
import { SupportTicketTypeormEntity } from '../entities/support-ticket.typeorm-entity';
import { SupportTicketMessageTypeormEntity } from '../entities/support-ticket-message.typeorm-entity';
import { SupportTicketAttachmentTypeormEntity } from '../entities/support-ticket-attachment.typeorm-entity';
import { SupportTicketMapper } from '../mappers/support-ticket.mapper';
import { SupportTicketMessageMapper } from '../mappers/support-ticket-message.mapper';
import { SupportTicketAttachmentMapper } from '../mappers/support-ticket-attachment.mapper';

/**
 * Поля обращения, по которым разрешена сортировка.
 *
 * Список один на обе стороны. Их было два: пайщику сортировка по исполнителю
 * была закрыта, потому что упорядочивание по скрытому полю восстанавливает его
 * значения без прямого показа. Обезличивание отменено 25.08.2026, исполнитель
 * больше не скрыт — и второй причины для разделения не нашлось ни в
 * спецификации, ни в комментариях фазы 2.
 *
 * Сам список нужен и дальше: TypeORM отвергает только несуществующее свойство,
 * а `subject`, `authorUsername` и `body` — настоящие колонки, сортировка по
 * которым прошла бы. Здесь перечислено то, по чему списки упорядочивать
 * осмысленно.
 */
const TICKET_SORT_FIELDS: ReadonlyArray<keyof SupportTicketDomainEntity> = [
  'number',
  'kind',
  'status',
  'priority',
  'assigneeUsername',
  'responsibilityZone',
  'lastMessageAt',
  'resolvedAt',
  'escalatedAt',
  'reopenCount',
  'createdAt',
  'updatedAt',
];

type SupportTicketUpdateFields = Omit<
  SupportTicketDomainEntity,
  'id' | 'number' | 'coopname' | 'authorUsername' | 'createdAt'
>;

// Локальная копия ~/shared/asserts/blockchain-type.assert.ts: из src/extensions/
// нельзя импортировать пути ~/... (расширение готовится к выносу из монолита),
// поэтому та же проверка воспроизведена здесь, а не переиспользована из ядра.
//
// Ловит расхождение доменных полей update() и колонок ORM-сущности при сборке:
// обычное присваивание `x: Partial<Entity> = changes` компилятор пропускает
// молча даже при переименованном поле (Partial делает все поля необязательными,
// и лишнее/недостающее поле — не ошибка структурной совместимости). Условный
// тип ниже проверяет набор ключей явно.
type MissingEntityKeys = Exclude<keyof SupportTicketUpdateFields, keyof SupportTicketTypeormEntity>;
type UpdateFieldsMatchEntity = MissingEntityKeys extends never
  ? true
  : ['❌ Полей нет в SupportTicketTypeormEntity:', MissingEntityKeys] & false;
// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
function assertUpdateFieldsMatchEntity<T extends true>() {}
assertUpdateFieldsMatchEntity<UpdateFieldsMatchEntity>();

@Injectable()
export class SupportTicketTypeormRepository implements SupportTicketRepository {
  constructor(
    @InjectRepository(SupportTicketTypeormEntity)
    private readonly repository: Repository<SupportTicketTypeormEntity>
  ) {}

  // lastMessageAt не в Omit-списке ниже: он обязателен во входных данных.
  // Значение выставляет вызывающий сервис (первое сообщение = момент
  // создания обращения), репозиторий его не подставляет и не умолчивает.
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
    return this.findPaginated(
      { status: In(statuses) },
      { lastMessageAt: 'DESC' },
      TICKET_SORT_FIELDS,
      options
    );
  }

  async findByAuthor(
    authorUsername: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated({ authorUsername }, { createdAt: 'DESC' }, TICKET_SORT_FIELDS, options);
  }

  async findByAssignee(
    assigneeUsername: string,
    statuses?: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated(
      { assigneeUsername, ...(statuses ? { status: In(statuses) } : {}) },
      { createdAt: 'DESC' },
      TICKET_SORT_FIELDS,
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
      TICKET_SORT_FIELDS,
      options
    );
  }

  // Без limit/pagination: вызывающий (таймер автозакрытия) обходит весь
  // результат за один проход. Годится, пока фоновая задача одна и кандидатов
  // на закрытие не тысячи одновременно — при росте объёма стоит батчевать.
  async findResolvedBefore(cutoff: Date): Promise<SupportTicketDomainEntity[]> {
    const entities = await this.repository.find({
      where: { status: SupportTicketStatus.RESOLVED, resolvedAt: LessThanOrEqual(cutoff) },
    });
    return entities.map(SupportTicketMapper.toDomain);
  }

  async findEscalated(options?: PaginationInputDTO): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated(
      { escalatedAt: Not(IsNull()) },
      { escalatedAt: 'DESC' },
      TICKET_SORT_FIELDS,
      options
    );
  }

  async findByFilter(
    filter: SupportTicketFilter,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    return this.findPaginated(
      this.buildFilterWhere(filter),
      { lastMessageAt: 'DESC' },
      TICKET_SORT_FIELDS,
      options
    );
  }

  async findByAuthorFilter(
    authorUsername: string,
    filter: SupportMemberTicketFilter,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    // Автор идёт после разбора фильтра, а не внутри него: даже если в фильтр
    // однажды просочится поле автора, оно будет перекрыто здесь и подделать
    // выборку через аргумент не выйдет.
    return this.findPaginated(
      { ...this.buildFilterWhere(filter), authorUsername },
      { lastMessageAt: 'DESC' },
      TICKET_SORT_FIELDS,
      options
    );
  }

  async countByStatus(): Promise<Record<SupportTicketStatus, number>> {
    const rows = await this.repository
      .createQueryBuilder('ticket')
      .select('ticket.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ticket.status')
      .getRawMany<{ status: SupportTicketStatus; count: string }>();

    // Нули присутствуют: группировка возвращает только непустые статусы, а
    // закладке очереди нужен полный набор — иначе «решённые» пропадут с
    // экрана вместо того, чтобы показать ноль.
    const counters = Object.fromEntries(
      Object.values(SupportTicketStatus).map((status) => [status, 0])
    ) as Record<SupportTicketStatus, number>;

    for (const row of rows) {
      // COUNT возвращается строкой — приведение обязательно.
      counters[row.status] = Number(row.count);
    }
    return counters;
  }

  /**
   * Разбор фильтра в условие выборки.
   *
   * Пустые поля не попадают в условие вовсе: пустой фильтр обязан дать всё, а
   * не пустую страницу. Поиск по теме — сравнение подстроки без учёта регистра
   * (`ILIKE`) по колонке `subject`; спецсимволы шаблона экранируются, иначе
   * пайщик, набравший `%`, получил бы всю очередь.
   */
  private buildFilterWhere(filter: SupportTicketFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filter.statuses?.length) where.status = In(filter.statuses);
    if (filter.kind) where.kind = filter.kind;
    if (filter.priority) where.priority = filter.priority;
    if (filter.assigneeUsername) where.assigneeUsername = filter.assigneeUsername;
    if (filter.authorUsername) where.authorUsername = filter.authorUsername;
    if (filter.escalated !== undefined) {
      where.escalatedAt = filter.escalated ? Not(IsNull()) : IsNull();
    }

    const search = filter.subjectContains?.trim();
    if (search) where.subject = ILike(`%${this.escapeLikePattern(search)}%`);

    return where;
  }

  /** `%`, `_` и `\` внутри искомой строки — литералы, а не шаблон поиска. */
  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }

  async update(id: string, changes: SupportTicketChanges): Promise<SupportTicketDomainEntity> {
    // Свойства домена и TypeORM-сущности совпадают 1:1 (camelCase), поэтому
    // партиал передаётся как есть — прогон через toEntity() затронул бы и
    // не указанные вызывающим поля, подставив им undefined. Совпадение
    // ключей проверяет assertUpdateFieldsMatchEntity() выше по файлу; здесь
    // остаётся структурная передача без риска молчаливого расхождения.
    const entityChanges: Partial<SupportTicketTypeormEntity> = changes;
    await this.repository.update({ id }, entityChanges);
    const updated = await this.repository.findOne({ where: { id } });
    if (!updated) throw new Error(`Обращение ${id} не найдено после обновления`);
    return SupportTicketMapper.toDomain(updated);
  }

  // ── Атомарные записи ────────────────────────────────────────────────
  //
  // Граница транзакции живёт здесь, потому что другой в контроллере нет:
  // ни декоратора, ни единицы работы, ни менеджера в контейнере. Приём взят
  // с единственного существующего образца — `manager.transaction` внутри
  // инфраструктурного адаптера (marketplace-inventory-repository).
  //
  // Условий про статусы, роли и допустимость переходов здесь намеренно нет
  // (кроме условного гейта автозакрытия, где условие и есть суть операции):
  // что записать — решает сервис, репозиторий только записывает атомарно.

  async createWithFirstMessage(
    ticket: Omit<SupportTicketDomainEntity, 'id' | 'number' | 'createdAt' | 'updatedAt'>,
    firstMessage: SupportLedgerEntryDraft
  ): Promise<{
    ticket: SupportTicketDomainEntity;
    message: SupportTicketMessageDomainEntity;
    attachments: SupportTicketAttachmentDomainEntity[];
  }> {
    return this.repository.manager.transaction(async (em) => {
      const savedTicket = await em.save(
        em.create(SupportTicketTypeormEntity, SupportTicketMapper.toEntity(ticket))
      );
      const { message, attachments } = await this.appendEntry(em, savedTicket.id, firstMessage);
      return { ticket: SupportTicketMapper.toDomain(savedTicket), message, attachments };
    });
  }

  async appendAndUpdate(
    ticketId: string,
    messages: SupportLedgerEntryDraft[],
    changes: SupportTicketChanges
  ): Promise<{ ticket: SupportTicketDomainEntity; messages: SupportTicketMessageDomainEntity[] }> {
    return this.repository.manager.transaction(async (em) => {
      const saved: SupportTicketMessageDomainEntity[] = [];
      for (const entry of messages) {
        const { message } = await this.appendEntry(em, ticketId, entry);
        saved.push(message);
      }

      // Пустой changes — законный случай (запись в ленту без правки шапки),
      // но `update` с пустым партиалом TypeORM считает ошибкой, поэтому вызов
      // делается только когда есть что менять.
      if (Object.keys(changes).length > 0) {
        await em.update(SupportTicketTypeormEntity, { id: ticketId }, this.toEntityChanges(changes));
      }

      const updated = await em.findOne(SupportTicketTypeormEntity, { where: { id: ticketId } });
      if (!updated) throw new Error(`Обращение ${ticketId} не найдено после обновления`);
      return { ticket: SupportTicketMapper.toDomain(updated), messages: saved };
    });
  }

  async closeIfStillResolved(
    ticketId: string,
    cutoff: Date,
    systemMessage: SupportLedgerEntryDraft
  ): Promise<{ ticket: SupportTicketDomainEntity; message: SupportTicketMessageDomainEntity } | null> {
    return this.repository.manager.transaction(async (em) => {
      // Условие в самом UPDATE, а не отдельной проверкой перед ним: между
      // чтением и записью автор успел бы вернуть обращение в работу. Здесь
      // строка либо подходит под условие в момент записи, либо не подходит —
      // третьего нет, и повторный тик безопасен по той же причине.
      const result = await em.update(
        SupportTicketTypeormEntity,
        { id: ticketId, status: SupportTicketStatus.RESOLVED, resolvedAt: LessThanOrEqual(cutoff) },
        { status: SupportTicketStatus.CLOSED, lastMessageAt: new Date() }
      );
      if (!result.affected) return null;

      const { message } = await this.appendEntry(em, ticketId, systemMessage);
      const closed = await em.findOne(SupportTicketTypeormEntity, { where: { id: ticketId } });
      if (!closed) throw new Error(`Обращение ${ticketId} не найдено после закрытия`);
      return { ticket: SupportTicketMapper.toDomain(closed), message };
    });
  }

  /** Запись ленты вместе с её вложениями в уже открытой транзакции. */
  private async appendEntry(
    em: EntityManager,
    ticketId: string,
    entry: SupportLedgerEntryDraft
  ): Promise<{
    message: SupportTicketMessageDomainEntity;
    attachments: SupportTicketAttachmentDomainEntity[];
  }> {
    const savedMessage = await em.save(
      em.create(
        SupportTicketMessageTypeormEntity,
        SupportTicketMessageMapper.toEntity({ ...entry.message, ticketId })
      )
    );

    const attachments: SupportTicketAttachmentDomainEntity[] = [];
    for (const attachment of entry.attachments) {
      const savedAttachment = await em.save(
        em.create(
          SupportTicketAttachmentTypeormEntity,
          SupportTicketAttachmentMapper.toEntity({
            ...attachment,
            ticketId,
            messageId: savedMessage.id,
          })
        )
      );
      attachments.push(SupportTicketAttachmentMapper.toDomain(savedAttachment));
    }

    return { message: SupportTicketMessageMapper.toDomain(savedMessage), attachments };
  }

  /**
   * Доменный партиал → партиал ORM-сущности. Приведения нет: совпадение
   * ключей проверяет assertUpdateFieldsMatchEntity() выше по файлу.
   */
  private toEntityChanges(changes: SupportTicketChanges): Partial<SupportTicketTypeormEntity> {
    return changes;
  }

  private async findPaginated(
    where: Record<string, unknown>,
    defaultOrder: Record<string, 'ASC' | 'DESC'>,
    allowedSortFields: ReadonlyArray<keyof SupportTicketDomainEntity>,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>> {
    const validated = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortOrder: 'ASC' as const };

    if (validated.sortBy && !allowedSortFields.includes(validated.sortBy as keyof SupportTicketDomainEntity)) {
      throw new Error(
        `Сортировка обращений по полю "${validated.sortBy}" не поддерживается. Допустимые поля: ${allowedSortFields.join(', ')}`
      );
    }

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
