import { Inject, Injectable } from '@nestjs/common';
import type { Expression, SqlBool } from 'kysely';
import { ApprovalDomainEntity } from '../../domain/entities/approval.entity';
import { ApprovalTypeormEntity } from '../entities/approval-typeorm.entity';
import { ApprovalMapper } from '../mappers/approval.mapper';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import { CHAIRMAN_APPROVAL_STORE } from '../database/chairman-stores';
import type { ApprovalRepository } from '../../domain/repositories/approval.repository';
import type { ApprovalFilterInput } from '../../application/dto/approval-filter.input';
import {
  PaginationInputDTO,
  PaginationResult,
  PaginationUtils,
  oneOf,
  sortColumn,
  sortDirection,
  type TableStore,
} from '@coopenomics/extension-kit';

/** Колонки, по которым список одобрений можно сортировать. */
const SORTABLE = [
  'created_at',
  'id',
  'coopname',
  'username',
  'status',
  'approval_hash',
  'callback_contract',
  'callback_action_approve',
  'callback_action_decline',
  'meta',
  'block_num',
  'present',
  '_id',
  '_created_at',
  '_updated_at',
] as const;

/** Хранилище зеркала одобрений председателя. */
@Injectable()
export class ApprovalTypeormRepository
  extends BaseChainRepository<ApprovalDomainEntity, ApprovalTypeormEntity>
  implements ApprovalRepository
{
  constructor(
    @Inject(CHAIRMAN_APPROVAL_STORE) repository: TableStore<ApprovalTypeormEntity>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: ApprovalMapper.toDomain,
      toEntity: ApprovalMapper.toEntity,
    };
  }

  protected createDomainEntity(databaseData: any, blockchainData: any): ApprovalDomainEntity {
    return new ApprovalDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ApprovalDomainEntity.getSyncKey();
  }

  // Пагинированный поиск с фильтрами
  async findAllPaginated(
    filter?: ApprovalFilterInput,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ApprovalDomainEntity>> {
    // Валидируем параметры пагинации
    const validatedOptions: PaginationInputDTO = options
      ? PaginationUtils.validatePaginationOptions(options)
      : {
          page: 1,
          limit: 50,
          sortBy: undefined,
          sortOrder: 'DESC' as const,
        };

    // Получаем параметры для SQL запроса
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    const query = this.repository.kysely.selectFrom('chairman_approvals').where((eb) => {
      const conditions: Expression<SqlBool>[] = [];
      if (filter?.coopname) conditions.push(eb('coopname', '=', filter.coopname));
      if (filter?.username) conditions.push(eb('username', '=', filter.username));
      if (filter?.statuses && filter.statuses.length > 0) conditions.push(eb('status', 'in', filter.statuses));
      // Поиск по части хэша.
      if (filter?.approval_hash) conditions.push(eb('approval_hash', 'ilike', `%${filter.approval_hash}%`));
      if (filter?.created_from) conditions.push(eb('created_at', '>=', filter.created_from));
      if (filter?.created_to) conditions.push(eb('created_at', '<=', filter.created_to));
      return eb.and(conditions);
    });

    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    const totalCount = Number(total.count);

    const column = sortColumn(SORTABLE, validatedOptions.sortBy, 'created_at');
    const direction = validatedOptions.sortBy ? sortDirection(validatedOptions.sortOrder) : 'desc';
    const rows = await query.selectAll().orderBy(column, direction).offset(offset).limit(limit).execute();
    const items = this.repository.records(rows).map((entity) => ApprovalMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }

  // Специфичные методы репозитория одобрений
  async findByCoopname(coopname: string): Promise<ApprovalDomainEntity[]> {
    const entities = await this.repository.find({ coopname });
    return entities.map(ApprovalMapper.toDomain);
  }

  async findByUsername(username: string): Promise<ApprovalDomainEntity[]> {
    const entities = await this.repository.find({ username });
    return entities.map(ApprovalMapper.toDomain);
  }

  async findByActions(query: {
    coopname: string;
    actions: string[];
    usernames?: string[];
    statuses?: string[];
  }): Promise<ApprovalDomainEntity[]> {
    if (!query.actions.length || (query.usernames && !query.usernames.length)) return [];
    const where: Record<string, unknown> = { coopname: query.coopname, callback_action_approve: oneOf(query.actions) };
    if (query.usernames) where.username = oneOf(query.usernames);
    if (query.statuses?.length) where.status = oneOf(query.statuses);
    const entities = await this.repository.find(where, { order: { created_at: 'DESC' } });
    return entities.map((entity) => ApprovalMapper.toDomain(entity));
  }

  async findByApprovalHash(approvalHash: string): Promise<ApprovalDomainEntity | null> {
    const entity = await this.repository.findOne({ approval_hash: approvalHash.toLowerCase() });
    return entity ? ApprovalMapper.toDomain(entity) : null;
  }

  // Типовые чтение, запись и откат форка наследуются от BaseChainRepository
}
