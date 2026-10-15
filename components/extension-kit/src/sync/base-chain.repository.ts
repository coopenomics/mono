import { Injectable } from '@nestjs/common';
import type { TableStore, Where } from '../database/table-store';
import { moreThan } from '../database/table-store';
import type { IBlockchainSyncRepository, IBlockchainSynchronizable } from './blockchain-sync.interface';
import type { IBaseDatabaseData } from './base-database.interface';
import { ChainVersioningService } from './chain-versioning.service';

/**
 * Базовое хранилище зеркала цепи на Kysely: общая реализация синхронизации с
 * блокчейном (поиск по ключу синхронизации, создание из дельты, откат форка)
 * и обычного чтения и записи. Работает через шлюз таблицы; версии записей
 * перед изменением и архив форка ведёт `ChainVersioningService`.
 */
@Injectable()
export abstract class BaseChainRepository<TDomainEntity extends IBlockchainSynchronizable, TRecord extends IBaseDatabaseData>
  implements IBlockchainSyncRepository<TDomainEntity>
{
  protected constructor(
    protected readonly repository: TableStore<TRecord>,
    protected readonly versioning: ChainVersioningService
  ) {}

  /** Перевод между доменной сущностью и записью таблицы. */
  protected abstract getMapper(): {
    toDomain: (record: TRecord) => TDomainEntity;
    toEntity: (domainEntity: TDomainEntity) => Partial<TRecord>;
  };

  /** Доменная сущность из данных базы и цепи — задаёт наследник. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract createDomainEntity(databaseData: any, blockchainData: any): TDomainEntity;

  /** Ключ синхронизации таблицы — задаёт наследник. */
  protected abstract getSyncKey(): string;

  protected getEntityTableName(): string {
    return this.repository.table;
  }

  async findBySyncKey(syncKey: string, syncValue: string): Promise<TDomainEntity | null> {
    // Числовые ключи (id) приходят из дельт числом — приводим к строке.
    const record = await this.repository.findOne({ [syncKey]: String(syncValue).toLowerCase() } as Where<TRecord>);
    return record ? this.getMapper().toDomain(record) : null;
  }

  async findByBlockNumGreaterThan(blockNum: number): Promise<TDomainEntity[]> {
    const records = await this.repository.find({ block_num: moreThan(blockNum) } as Where<TRecord>);
    return records.map((record) => this.getMapper().toDomain(record));
  }

  /** Создаёт запись из данных цепи либо обновляет существующую. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createIfNotExists(blockchainData: any, blockNum: number, present = true): Promise<TDomainEntity> {
    const syncKey = this.getSyncKey();
    const syncValue = this.extractSyncValueFromBlockchainData(blockchainData, syncKey);
    const existing = await this.findBySyncKey(syncKey, syncValue);
    if (!existing) {
      const now = new Date();
      const created = this.createDomainEntity(
        { _id: '', block_num: blockNum, present, _created_at: now, _updated_at: now, [syncKey]: String(syncValue).toLowerCase() },
        blockchainData
      );
      return this.save(created);
    }
    // Устаревшая дельта (из более раннего блока) не затирает более свежую
    // запись. Блок из базы может прийти строкой — сравниваем числами.
    const existingBlockNum = existing.getBlockNum();
    if (existingBlockNum != null && Number(blockNum) < Number(existingBlockNum)) return existing;
    existing.updateFromBlockchain(blockchainData, blockNum, present);
    return this.save(existing);
  }

  async deleteByBlockNumGreaterThan(blockNum: number): Promise<void> {
    await this.repository.delete({ block_num: moreThan(blockNum) } as Where<TRecord>);
  }

  async restoreFromVersions(forkBlockNum: number): Promise<void> {
    await this.versioning.restoreVersionsAfterFork(this.repository, forkBlockNum);
  }

  /** Переносит записи после блока форка в архив и убирает их из таблицы. */
  async archiveInvalidatedSince(forkBlockNum: number, forkEventId?: string | null): Promise<number> {
    return this.versioning.archiveAndDeleteLiveAfterFork(this.repository, forkBlockNum, forkEventId);
  }

  /** Переносит версии после блока форка в архив; зовётся после восстановления. */
  async archiveInvalidatedVersionsSince(forkBlockNum: number, forkEventId?: string | null): Promise<number> {
    return this.versioning.archiveAndDeleteVersionsAfterFork(this.getEntityTableName(), forkBlockNum, forkEventId);
  }

  async update(entity: TDomainEntity): Promise<TDomainEntity> {
    return this.persist(entity, 'update');
  }

  async save(entity: TDomainEntity): Promise<TDomainEntity> {
    return this.persist(entity, 'save');
  }

  /** Заготовка записи без сохранения в базу. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create(entity: TDomainEntity): Promise<any> {
    return this.repository.create(this.getMapper().toEntity(entity));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveCreated(record: any): Promise<TDomainEntity> {
    return this.getMapper().toDomain(await this.repository.save(withoutEmptyKey(record)));
  }

  async findAll(): Promise<TDomainEntity[]> {
    const records = await this.repository.find();
    return records.map((record) => this.getMapper().toDomain(record));
  }

  async findById(_id: string): Promise<TDomainEntity | null> {
    const record = await this.repository.findOne({ _id } as Where<TRecord>);
    return record ? this.getMapper().toDomain(record) : null;
  }

  async delete(_id: string): Promise<void> {
    await this.repository.delete({ _id } as Where<TRecord>);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected extractSyncValueFromBlockchainData(blockchainData: any, syncKey: string): string {
    const value = blockchainData[syncKey];
    if (value === null || value === undefined) {
      throw new Error(`Sync key '${syncKey}' not found in blockchain data`);
    }
    return value.toString().toLowerCase();
  }

  /** Сохраняет запись; у существующей перед изменением кладёт прежнее состояние в версии. */
  private async persist(entity: TDomainEntity, changeType: string): Promise<TDomainEntity> {
    const record = withoutEmptyKey(this.getMapper().toEntity(entity));
    if (record._id) {
      await this.versioning.saveVersionBeforeUpdate(this.repository, record, record.block_num || null, changeType);
    }
    return this.getMapper().toDomain(await this.repository.save(record));
  }
}

/** Пустой ключ у новой записи убирается: ключ выдаёт база. */
function withoutEmptyKey<TRecord extends IBaseDatabaseData>(record: Partial<TRecord>): Partial<TRecord> {
  if (!record._id) delete record._id;
  return record;
}
