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

/**
 * Поля обращения, по которым разрешена сортировка со стороны автора.
 *
 * `assigneeUsername` сюда не входит: автору обращения не показывают, кто из
 * совета с ним работает, а сортировка по скрытому полю восстановила бы это
 * без прямого отображения значения (значения operator'ов легли бы по порядку).
 */
const TICKET_SORT_FIELDS: ReadonlyArray<keyof SupportTicketDomainEntity> = [
  'number',
  'kind',
  'status',
  'priority',
  'responsibilityZone',
  'lastMessageAt',
  'resolvedAt',
  'escalatedAt',
  'reopenCount',
  'createdAt',
  'updatedAt',
];

/**
 * То же самое, плюс `assigneeUsername` — для методов, вызываемых со стороны
 * совета/оператора (findByStatuses/findByAssignee/findByKind/findEscalated),
 * где это поле не является скрытым от вызывающего.
 */
const TICKET_SORT_FIELDS_OPERATOR: ReadonlyArray<keyof SupportTicketDomainEntity> = [
  ...TICKET_SORT_FIELDS,
  'assigneeUsername',
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
      TICKET_SORT_FIELDS_OPERATOR,
      options
    );
  }

  // Единственный метод, читаемый со стороны автора обращения (список "мои
  // обращения") — поэтому сортировка ограничена TICKET_SORT_FIELDS без
  // assigneeUsername. Остальные find*-методы ключуются по статусу/kind/
  // исполнителю, то есть уже сами по себе — обзор совета/оператора.
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
      TICKET_SORT_FIELDS_OPERATOR,
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
      TICKET_SORT_FIELDS_OPERATOR,
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
      TICKET_SORT_FIELDS_OPERATOR,
      options
    );
  }

  async update(
    id: string,
    changes: Partial<
      Omit<SupportTicketDomainEntity, 'id' | 'number' | 'coopname' | 'authorUsername' | 'createdAt'>
    >
  ): Promise<SupportTicketDomainEntity> {
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
