import { CORE_AGREEMENT_STORE } from '../../kysely/core-stores';
import { PaginationUtils, type TableStore, oneOf, within } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { AgreementDomainEntity } from '~/domain/agreement/entities/agreement.entity';
import { AgreementTypeormEntity } from '../entities/agreement.typeorm-entity';
import { AgreementMapper } from '../mappers/agreement.mapper';
import type { AgreementRepository, AgreementFilterInput } from '~/domain/agreement/repositories/agreement.repository';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IAgreementBlockchainData } from '~/domain/agreement/interfaces/agreement-blockchain.interface';
import type { IAgreementDatabaseData } from '~/domain/agreement/interfaces/agreement-database.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';

/**
 * TypeORM реализация репозитория соглашений
 */
@Injectable()
export class AgreementTypeormRepository
  extends BaseChainRepository<AgreementDomainEntity, AgreementTypeormEntity>
  implements AgreementRepository, IBlockchainSyncRepository<AgreementDomainEntity>
{
  constructor(
    @Inject(CORE_AGREEMENT_STORE) repository: TableStore<AgreementTypeormEntity>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: AgreementMapper.toDomain,
      toEntity: AgreementMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IAgreementDatabaseData,
    blockchainData: IAgreementBlockchainData
  ): AgreementDomainEntity {
    return new AgreementDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return AgreementDomainEntity.getSyncKey();
  }

  // Пагинированный поиск с фильтрами
  async findAllPaginated(
    filter?: AgreementFilterInput,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<AgreementDomainEntity>> {
    // Валидируем параметры пагинации
    const validatedOptions: PaginationInputDomainInterface = options
      ? PaginationUtils.validatePaginationOptions(options)
      : {
          page: 1,
          limit: 50,
          sortBy: undefined,
          sortOrder: 'DESC' as const,
        };

    // Получаем параметры для SQL запроса
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    const where: Record<string, unknown> = {};
    if (filter?.coopname) where.coopname = filter.coopname;
    if (filter?.username) where.username = filter.username;
    if (filter?.type) where.type = filter.type;
    if (filter?.program_id !== undefined) where.program_id = filter.program_id;
    if (filter?.statuses && filter.statuses.length > 0) where.blockchain_status = oneOf(filter.statuses);
    if (filter?.created_from || filter?.created_to) where._created_at = within(filter.created_from, filter.created_to);

    // Имя вне полей записи заменяется датой создания; порядок по умолчанию — свежие первыми.
    const sortBy = this.repository.sortField(validatedOptions.sortBy, '_created_at');
    const [entities, totalCount] = await this.repository.findAndCount(where, {
      order: { [sortBy]: validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC' },
      offset,
      limit,
    });

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => AgreementMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }

  // Специфичные методы репозитория соглашений
  async findByCoopname(coopname: string): Promise<AgreementDomainEntity[]> {
    const entities = await this.repository.find({ coopname });
    return entities.map(AgreementMapper.toDomain);
  }

  async findByUsername(username: string): Promise<AgreementDomainEntity[]> {
    const entities = await this.repository.find({ username });
    return entities.map(AgreementMapper.toDomain);
  }

  async findByType(type: string): Promise<AgreementDomainEntity[]> {
    const entities = await this.repository.find({ type });
    return entities.map(AgreementMapper.toDomain);
  }

  async findByProgramId(program_id: number): Promise<AgreementDomainEntity[]> {
    const entities = await this.repository.find({ program_id: program_id });
    return entities.map(AgreementMapper.toDomain);
  }
}
