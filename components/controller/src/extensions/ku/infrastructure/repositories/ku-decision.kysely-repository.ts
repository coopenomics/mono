import { KU_DECISION_STORE } from '../database/ku-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type {
  KuDecisionFilterDomainInterface,
  KuDecisionPrivateDataDomainInterface,
  KuDecisionRepository,
} from '../../domain/repositories/ku-decision.repository';
import { KuDecisionDomainEntity } from '../../domain/entities/ku-decision.entity';
import { KuDecisionRecord } from '../entities/ku-decision.record';
import { KuDecisionMapper } from '../mappers/ku-decision.mapper';
import type {
  IKuDecisionBlockchainData,
  IKuDecisionDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';
import { PaginationInputDTO, PaginationResult, PaginationUtils, pickDefined } from '@coopenomics/extension-kit';

@Injectable()
export class KuDecisionKyselyRepository
  extends BaseChainRepository<KuDecisionDomainEntity, KuDecisionRecord>
  implements KuDecisionRepository, IBlockchainSyncRepository<KuDecisionDomainEntity>
{
  constructor(
    @Inject(KU_DECISION_STORE) repository: TableStore<KuDecisionRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: KuDecisionMapper.toDomain,
      toEntity: KuDecisionMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IKuDecisionDatabaseData,
    blockchainData: IKuDecisionBlockchainData
  ): KuDecisionDomainEntity {
    return new KuDecisionDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return KuDecisionDomainEntity.getSyncKey();
  }

  async findByHash(hash: string): Promise<KuDecisionDomainEntity | null> {
    const entity = await this.repository.findOne({ hash: hash.toLowerCase() });
    return entity ? KuDecisionMapper.toDomain(entity) : null;
  }

  async upsertPrivateData(data: KuDecisionPrivateDataDomainInterface): Promise<void> {
    const hash = data.hash.toLowerCase();
    const existing = await this.repository.findOne({ hash });

    // Правятся только переданные поля: незаданное прежнее значение не затирает.
    const privateFields: Partial<KuDecisionRecord> = pickDefined(data, [
      'meet_place',
      'meet_at',
      'branch_name',
      'branch_email',
      'branch_phone',
      'cancelled',
    ]);

    if (existing) {
      await this.repository.update({ _id: existing._id }, privateFields);
      return;
    }

    // Запись из синка ещё не пришла — создаём placeholder, который синк дополнит
    await this.repository.save(
      this.repository.create({
        hash,
        coopname: data.coopname ?? '',
        type: data.type ?? '',
        initiator: data.initiator ?? '',
        present: false,
        ...privateFields,
      })
    );
  }

  async saveAuthorization(hash: string, authorization: object): Promise<void> {
    await this.repository.update({ hash: hash.toLowerCase() }, { authorization });
  }

  async findMeetingsForReminder(from: Date, to: Date): Promise<KuDecisionDomainEntity[]> {
    const rows = await this.repository
      .select()
      .where('present', '=', true)
      .where('cancelled', '=', false)
      .where('meet_reminder_sent', '=', false)
      .where('meet_at', '>=', from)
      .where('meet_at', '<', to)
      .execute();
    const entities = this.repository.records(rows);
    return entities.map((entity) => KuDecisionMapper.toDomain(entity));
  }

  async markReminderSent(hash: string): Promise<void> {
    await this.repository.update({ hash: hash.toLowerCase() }, { meet_reminder_sent: true });
  }

  async update(entity: KuDecisionDomainEntity): Promise<KuDecisionDomainEntity> {
    const updateData = KuDecisionMapper.toUpdateEntity(entity);
    await this.repository.update({ _id: entity._id }, updateData);

    const updatedEntity = await this.repository.findOne({ _id: entity._id });
    if (!updatedEntity) {
      // i18n-ignore: внутренний инвариант согласованности после обновления записи в БД, до пайщика не доходит
      throw new Error(`Решение собрания участка ${entity.hash} не найдено после обновления`);
    }

    return KuDecisionMapper.toDomain(updatedEntity);
  }

  async findAllPaginated(
    filter?: KuDecisionFilterDomainInterface,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<KuDecisionDomainEntity>> {
    const validatedOptions: PaginationInputDTO = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortBy: undefined, sortOrder: 'ASC' as const };

    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    const where: any = {};
    if (filter?.coopname) where.coopname = filter.coopname;
    if (filter?.type) where.type = filter.type;
    if (filter?.status) where.status = filter.status;
    if (filter?.braname) where.braname = filter.braname;
    if (filter?.initiator) where.initiator = filter.initiator;
    if (filter?.present !== undefined) where.present = filter.present;

    const totalCount = await this.repository.count(where);

    const orderBy: any = {};
    // Имя вне колонок — сортировка по умолчанию: до 25.09.2026 оно уходило в
    // ORDER BY и роняло список ошибкой 500 (C28-80).
    const sortColumn = this.repository.sortField(validatedOptions.sortBy, '_created_at');
    orderBy[sortColumn] = sortColumn === validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC';

    const entities = await this.repository.find(where, { order: orderBy, limit: limit, offset: offset });

    const items = entities.map((entity) => KuDecisionMapper.toDomain(entity));

    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
