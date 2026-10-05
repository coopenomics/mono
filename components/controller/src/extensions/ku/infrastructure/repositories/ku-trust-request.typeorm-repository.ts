import { KU_TRUST_REQUEST_STORE } from '../database/ku-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type {
  KuTrustRequestFilterDomainInterface,
  KuTrustRequestRepository,
} from '../../domain/repositories/ku-trust-request.repository';
import { KuTrustRequestDomainEntity } from '../../domain/entities/ku-trust-request.entity';
import { KuTrustRequestTypeormEntity } from '../entities/ku-trust-request.typeorm-entity';
import { KuTrustRequestMapper } from '../mappers/ku-trust-request.mapper';
import type {
  IKuTrustRequestBlockchainData,
  IKuTrustRequestDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';
import { PaginationInputDTO, PaginationResult, PaginationUtils } from '@coopenomics/extension-kit';

@Injectable()
export class KuTrustRequestTypeormRepository
  extends BaseChainRepository<KuTrustRequestDomainEntity, KuTrustRequestTypeormEntity>
  implements KuTrustRequestRepository, IBlockchainSyncRepository<KuTrustRequestDomainEntity>
{
  constructor(
    @Inject(KU_TRUST_REQUEST_STORE) repository: TableStore<KuTrustRequestTypeormEntity>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: KuTrustRequestMapper.toDomain,
      toEntity: KuTrustRequestMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IKuTrustRequestDatabaseData,
    blockchainData: IKuTrustRequestBlockchainData
  ): KuTrustRequestDomainEntity {
    return new KuTrustRequestDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return KuTrustRequestDomainEntity.getSyncKey();
  }

  async findByHash(hash: string): Promise<KuTrustRequestDomainEntity | null> {
    const entity = await this.repository.findOne({ hash: hash.toLowerCase() });
    return entity ? KuTrustRequestMapper.toDomain(entity) : null;
  }

  async update(entity: KuTrustRequestDomainEntity): Promise<KuTrustRequestDomainEntity> {
    const updateData = KuTrustRequestMapper.toUpdateEntity(entity);
    await this.repository.update({ _id: entity._id }, updateData);

    const updatedEntity = await this.repository.findOne({ _id: entity._id });
    if (!updatedEntity) {
      // i18n-ignore: внутренний инвариант согласованности после обновления записи в БД, до пайщика не доходит
      throw new Error(`Заявка доверенного ${entity.hash} не найдена после обновления`);
    }

    return KuTrustRequestMapper.toDomain(updatedEntity);
  }

  async findAllPaginated(
    filter?: KuTrustRequestFilterDomainInterface,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<KuTrustRequestDomainEntity>> {
    const validatedOptions: PaginationInputDTO = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortBy: undefined, sortOrder: 'ASC' as const };

    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    const where: any = {};
    if (filter?.coopname) where.coopname = filter.coopname;
    if (filter?.braname) where.braname = filter.braname;
    if (filter?.username) where.username = filter.username;
    if (filter?.present !== undefined) where.present = filter.present;

    const totalCount = await this.repository.count(where);

    const orderBy: any = {};
    // Имя вне колонок — сортировка по умолчанию: до 25.09.2026 оно уходило в
    // ORDER BY и роняло список ошибкой 500 (C28-80).
    const sortColumn = this.repository.sortField(validatedOptions.sortBy, '_created_at');
    orderBy[sortColumn] = sortColumn === validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC';

    const entities = await this.repository.find(where, { order: orderBy, limit: limit, offset: offset });

    const items = entities.map((entity) => KuTrustRequestMapper.toDomain(entity));

    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
