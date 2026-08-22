import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
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
  extends BaseBlockchainRepository<KuTrustRequestDomainEntity, KuTrustRequestTypeormEntity>
  implements KuTrustRequestRepository, IBlockchainSyncRepository<KuTrustRequestDomainEntity>
{
  constructor(
    @InjectRepository(KuTrustRequestTypeormEntity)
    repository: Repository<KuTrustRequestTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
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
    const entity = await this.repository.findOne({ where: { hash: hash.toLowerCase() } });
    return entity ? KuTrustRequestMapper.toDomain(entity) : null;
  }

  async update(entity: KuTrustRequestDomainEntity): Promise<KuTrustRequestDomainEntity> {
    const updateData = KuTrustRequestMapper.toUpdateEntity(entity);
    await this.repository.update(entity._id, updateData);

    const updatedEntity = await this.repository.findOne({ where: { _id: entity._id } });
    if (!updatedEntity) {
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

    const totalCount = await this.repository.count({ where });

    const orderBy: any = {};
    if (validatedOptions.sortBy) {
      orderBy[validatedOptions.sortBy] = validatedOptions.sortOrder;
    } else {
      orderBy._created_at = 'DESC';
    }

    const entities = await this.repository.find({
      where,
      skip: offset,
      take: limit,
      order: orderBy,
    });

    const items = entities.map((entity) => KuTrustRequestMapper.toDomain(entity));

    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
