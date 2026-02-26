import { AppendixDomainEntity } from '../../domain/entities/appendix.entity';
import { AppendixTypeormEntity } from '../entities/appendix.typeorm-entity';
import type { IAppendixDatabaseData } from '../../domain/interfaces/appendix-database.interface';
import type { IAppendixBlockchainData } from '../../domain/interfaces/appendix-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

type toEntityDatabasePart = RequireFields<Partial<AppendixTypeormEntity>, keyof IAppendixDatabaseData>;
/**
 * Мы выбрасываем статус из обновления так как он определяется действиями, а не дельтами
 */
type toEntityBlockchainPart = Omit<
  RequireFields<Partial<AppendixTypeormEntity>, keyof IAppendixBlockchainData>,
  'status'
> & {
  blockchain_status: string;
};

type toDomainDatabasePart = RequireFields<Partial<AppendixDomainEntity>, keyof IAppendixDatabaseData>;
type toDomainBlockchainPart = IAppendixBlockchainData;
/**
 * Маппер для преобразования между доменной сущностью приложения и TypeORM сущностью
 */
export class AppendixMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: AppendixTypeormEntity): AppendixDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      appendix_hash: entity.appendix_hash,
      status: entity.status,
      blockchain_status: entity.blockchain_status,
      contribution: entity.contribution ?? '',
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[AppendixDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        status: entity.blockchain_status,
        project_hash: entity.project_hash,
        appendix_hash: entity.appendix_hash,
        created_at: entity.created_at?.toISOString(),
        appendix: entity.appendix,
      };
    }
    return new AppendixDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: AppendixDomainEntity): Partial<AppendixTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      status: domain.status,
      appendix_hash: domain.appendix_hash,
      blockchain_status: domain.blockchain_status as string,
      contribution: domain.contribution ?? '',
      created_at: domain.created_at ? new Date(domain.created_at) : new Date(),
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[AppendixDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        project_hash: domain.project_hash as string,
        appendix_hash: domain.appendix_hash,
        blockchain_status: domain.blockchain_status as string,
        created_at: domain.created_at ? new Date(domain.created_at) : new Date(),
        appendix: domain.appendix as ISignedDocumentDomainInterface,
      };
    }

    return { ...dbPart, ...blockchainPart };
  }
}
