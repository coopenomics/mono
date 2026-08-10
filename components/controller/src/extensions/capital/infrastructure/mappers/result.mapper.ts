import { Injectable, Inject } from '@nestjs/common';
import { ResultDomainEntity } from '../../domain/entities/result.entity';
import { ResultTypeormEntity } from '../entities/result.typeorm-entity';
import type { IResultDatabaseData } from '../../domain/interfaces/result-database.interface';
import type { IResultBlockchainData } from '../../domain/interfaces/result-blockchain.interface';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ResultOutputDTO } from '../../application/dto/result_submission/result.dto';
import { DOCUMENT_PORT, type IDocumentPort } from '@coopenomics/innercoop';
import type { RequireFields } from '@coopenomics/extension-kit';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

type toEntityDatabasePart = RequireFields<Partial<ResultTypeormEntity>, keyof IResultDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ResultTypeormEntity>, keyof IResultBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ResultDomainEntity>, keyof IResultDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ResultDomainEntity>, keyof IResultBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью результата и TypeORM сущностью
 */
@Injectable()
export class ResultMapper {
  constructor(
    @Inject(DOCUMENT_PORT)
    private readonly documentPort: IDocumentPort
  ) {}
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ResultTypeormEntity): ResultDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      result_hash: entity.result_hash,
      status: entity.status,
      blockchain_status: entity.blockchain_status,
      project_hash: entity.project_hash,
      coopname: entity.coopname,
      username: entity.username,
      data: entity.data ?? '',
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[ResultDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        project_hash: entity.project_hash,
        result_hash: entity.result_hash,
        coopname: entity.coopname,
        username: entity.username,
        status: entity.status,
        blockchain_status: entity.blockchain_status,
        created_at: entity.created_at.toISOString(),
        debt_amount: entity.debt_amount,
        total_amount: entity.total_amount,
        statement: entity.statement,
        authorization: entity.authorization,
        act: entity.act,
      };
    }

    return new ResultDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ResultDomainEntity): Partial<ResultTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      result_hash: domain.result_hash,
      status: domain.status,
      blockchain_status: domain.blockchain_status as string,
      project_hash: domain.project_hash as string,
      coopname: domain.coopname as string,
      username: domain.username as string,
      data: domain.data as string,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[ResultDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        project_hash: domain.project_hash as string,
        result_hash: domain.result_hash,
        coopname: domain.coopname as string,
        username: domain.username as string,
        status: domain.blockchain_status as any,
        created_at: new Date(domain.created_at ?? new Date()),
        debt_amount: domain.debt_amount as string,
        total_amount: domain.total_amount as string,
        statement: domain.statement as ISignedDocument,
        authorization: domain.authorization as ISignedDocument,
        act: domain.act as ISignedDocument,
      };
    }

    return { ...dbPart, ...blockchainPart };
  }

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<ResultDomainEntity>): Partial<ResultTypeormEntity> {
    const updateData: Partial<ResultTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    // Примечание: Все поля из блокчейна (project_hash, result_hash, status, amounts, etc.)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }

  /**
   * Преобразование доменной сущности в DTO с обогащением документов
   */
  async toDTO(domain: ResultDomainEntity): Promise<ResultOutputDTO> {
    // Обогащаем документы в result
    const enrichedStatement =
      domain.statement && domain.statement.hash !== DomainToBlockchainUtils.getEmptyHash()
        ? await this.documentPort.buildAggregate(domain.statement)
        : null;

    const enrichedAuthorization =
      domain.authorization && domain.authorization.hash !== DomainToBlockchainUtils.getEmptyHash()
        ? await this.documentPort.buildAggregate(domain.authorization)
        : null;

    const enrichedAct =
      domain.act && domain.act.hash !== DomainToBlockchainUtils.getEmptyHash()
        ? await this.documentPort.buildAggregate(domain.act)
        : null;

    // Создаем ResultOutputDTO с обогащенными документами
    return {
      ...domain,
      statement: enrichedStatement ? new DocumentAggregateDTO(enrichedStatement) : undefined,
      authorization: enrichedAuthorization ? new DocumentAggregateDTO(enrichedAuthorization) : undefined,
      act: enrichedAct ? new DocumentAggregateDTO(enrichedAct) : undefined,
    } as ResultOutputDTO;
  }
}
