import { Injectable } from '@nestjs/common';
import { SegmentDomainEntity } from '../../domain/entities/segment.entity';
import { SegmentTypeormEntity } from '../entities/segment.typeorm-entity';
import { ResultMapper } from './result.mapper';
import type { ISegmentDatabaseData } from '../../domain/interfaces/segment-database.interface';
import type { ISegmentBlockchainData } from '../../domain/interfaces/segment-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import { SegmentOutputDTO } from '../../application/dto/segments/segment.dto';
import { ResultOutputDTO } from '../../application/dto/result_submission/result.dto';
import { DocumentAggregationService } from '~/domain/document/services/document-aggregation.service';
import { ContributorRepository } from '../../domain/repositories/contributor.repository';
import { CONTRIBUTOR_REPOSITORY } from '../../domain/repositories/contributor.repository';
import { AppendixRepository } from '../../domain/repositories/appendix.repository';
import { APPENDIX_REPOSITORY } from '../../domain/repositories/appendix.repository';
import { Inject } from '@nestjs/common';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';

type toEntityDatabasePart = RequireFields<Partial<SegmentTypeormEntity>, keyof ISegmentDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<SegmentTypeormEntity>, keyof ISegmentBlockchainData>;
type toDomainDatabasePart = RequireFields<Partial<SegmentDomainEntity>, keyof ISegmentDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<SegmentDomainEntity>, keyof ISegmentBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью сегмента и TypeORM сущностью
 */
@Injectable()
export class SegmentMapper {
  constructor(
    private readonly documentAggregationService: DocumentAggregationService,
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository,
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository
  ) {}
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: SegmentTypeormEntity): SegmentDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      is_completed: entity.is_completed,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[SegmentDomainEntity.getPrimaryKey()] !== undefined) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: Number(entity.id),
        project_hash: entity.project_hash.toLowerCase(),
        coopname: entity.coopname,
        username: entity.username,
        status: entity.status,

        // Роли участника
        is_author: entity.is_author,
        is_creator: entity.is_creator,
        is_coordinator: entity.is_coordinator,
        is_investor: entity.is_investor,
        is_propertor: entity.is_propertor,
        is_contributor: entity.is_contributor,
        has_vote: entity.has_vote,

        // Финансовые данные
        investor_amount: entity.investor_amount as string,
        investor_base: entity.investor_base as string,
        creator_base: entity.creator_base as string,
        creator_bonus: entity.creator_bonus as string,
        author_base: entity.author_base as string,
        author_bonus: entity.author_bonus as string,
        coordinator_investments: entity.coordinator_investments as string,
        coordinator_base: entity.coordinator_base as string,
        contributor_bonus: entity.contributor_bonus as string,
        property_base: entity.property_base as string,

        // CRPS поля
        last_author_base_reward_per_share: entity.last_author_base_reward_per_share,
        last_author_bonus_reward_per_share: entity.last_author_bonus_reward_per_share,
        last_contributor_reward_per_share: entity.last_contributor_reward_per_share,

        // Доли и пулы
        capital_contributor_shares: entity.capital_contributor_shares as string,
        last_known_invest_pool: entity.last_known_invest_pool as string,
        last_known_creators_base_pool: entity.last_known_creators_base_pool as string,
        last_known_coordinators_investment_pool: entity.last_known_coordinators_investment_pool as string,

        // Финансовые данные для ссуд
        provisional_amount: entity.provisional_amount as string,
        debt_amount: entity.debt_amount as string,
        debt_settled: entity.debt_settled as string,

        // Премии и бонусы
        equal_author_bonus: entity.equal_author_bonus as string,
        direct_creator_bonus: entity.direct_creator_bonus as string,
        voting_bonus: entity.voting_bonus as string,
        is_votes_calculated: entity.is_votes_calculated,

        // Общая стоимость
        total_segment_base_cost: entity.total_segment_base_cost as string,
        total_segment_bonus_cost: entity.total_segment_bonus_cost as string,
        total_segment_cost: entity.total_segment_cost as string,

        // Дополнительные поля из связанных сущностей
        display_name: entity.contributor?.display_name,

        // Интеллектуальная собственность и доли
        intellectual_cost: entity.intellectual_cost as string,
        share_percent: entity.share_percent,

        // Доступная сумма для конвертации в программу
        available_for_program: entity.available_for_program as string,
        // Доступная сумма для конвертации в кошелек
        available_for_wallet: entity.available_for_wallet as string,
      };
    }

    return new SegmentDomainEntity(databaseData, blockchainData, {
      display_name: entity.contributor?.display_name,
      result: entity.result ? ResultMapper.toDomain(entity.result) : undefined,
    });
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: SegmentDomainEntity): Partial<SegmentTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      status: domain.status,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
      is_completed: domain.is_completed ?? false,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[SegmentDomainEntity.getPrimaryKey()] !== undefined) {
      blockchainPart = {
        id: Number(domain.id),
        project_hash: domain.project_hash as string,
        coopname: domain.coopname as string,
        username: domain.username as string,
        status: domain.status,

        // Роли участника
        is_author: domain.is_author as boolean,
        is_creator: domain.is_creator as boolean,
        is_coordinator: domain.is_coordinator as boolean,
        is_investor: domain.is_investor as boolean,
        is_propertor: domain.is_propertor as boolean,
        is_contributor: domain.is_contributor as boolean,
        has_vote: domain.has_vote as boolean,

        // Финансовые данные
        investor_amount: domain.investor_amount as string,
        investor_base: domain.investor_base as string,
        creator_base: domain.creator_base as string,
        creator_bonus: domain.creator_bonus as string,
        author_base: domain.author_base as string,
        author_bonus: domain.author_bonus as string,
        coordinator_investments: domain.coordinator_investments as string,
        coordinator_base: domain.coordinator_base as string,
        contributor_bonus: domain.contributor_bonus as string,
        property_base: domain.property_base as string,

        // CRPS поля
        last_author_base_reward_per_share: domain.last_author_base_reward_per_share as number,
        last_author_bonus_reward_per_share: domain.last_author_bonus_reward_per_share as number,
        last_contributor_reward_per_share: domain.last_contributor_reward_per_share as number,

        // Доли и пулы
        capital_contributor_shares: domain.capital_contributor_shares as string,
        last_known_invest_pool: domain.last_known_invest_pool as string,
        last_known_creators_base_pool: domain.last_known_creators_base_pool as string,
        last_known_coordinators_investment_pool: domain.last_known_coordinators_investment_pool as string,

        // Финансовые данные для ссуд
        provisional_amount: domain.provisional_amount as string,
        debt_amount: domain.debt_amount as string,
        debt_settled: domain.debt_settled as string,

        // Премии и бонусы
        equal_author_bonus: domain.equal_author_bonus as string,
        direct_creator_bonus: domain.direct_creator_bonus as string,
        voting_bonus: domain.voting_bonus as string,
        is_votes_calculated: domain.is_votes_calculated as boolean,

        // Общая стоимость
        total_segment_base_cost: domain.total_segment_base_cost as string,
        total_segment_bonus_cost: domain.total_segment_bonus_cost as string,
        total_segment_cost: domain.total_segment_cost as string,

        // Интеллектуальная собственность и доли
        intellectual_cost: domain.intellectual_cost as string,
        share_percent: domain.share_percent as number,

        // Доступная сумма для конвертации в программу
        available_for_program: domain.available_for_program as string,
        // Доступная сумма для конвертации в кошелек
        available_for_wallet: domain.available_for_wallet as string,
      };
    }

    return { ...dbPart, ...blockchainPart };
  }

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<SegmentDomainEntity>): Partial<SegmentTypeormEntity> {
    const updateData: Partial<SegmentTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;
    if (domain.is_completed !== undefined) updateData.is_completed = domain.is_completed;

    // Примечание: Все поля из блокчейна (project_hash, coopname, status, amount, etc.)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }

  /**
   * Преобразование доменной сущности в DTO с обогащением связей
   * Централизованное место для подтягивания display_name и обогащения документов
   */
  async toDTO(domain: SegmentDomainEntity): Promise<SegmentOutputDTO> {
    // Получаем display_name из репозитория contributor
    let displayName = '';
    try {
      if (domain.username && domain.coopname) {
        const contributor = await this.contributorRepository.findByUsernameAndCoopname(domain.username, domain.coopname);
        displayName = contributor?.display_name || '';
      }
    } catch (error) {
      // Если не удалось получить contributor, оставляем пустую строку
      displayName = '';
    }

    // Получаем contribution из appendix
    let contribution: string | undefined = undefined;
    try {
      if (domain.username && domain.project_hash) {
        const appendix = await this.appendixRepository.findConfirmedByUsernameAndProjectHash(
          domain.username,
          domain.project_hash
        );
        contribution = appendix?.contribution;
      }
    } catch (error) {
      // Если не удалось получить appendix, оставляем undefined
      contribution = undefined;
    }

    // Обогащаем документы в result
    let enrichedResult: ResultOutputDTO | undefined = undefined;
    if (domain.result) {
      // Обогащаем документы в result
      const enrichedStatement = domain.result.statement
        ? await this.documentAggregationService.buildDocumentAggregate(domain.result.statement)
        : null;

      const enrichedAuthorization = domain.result.authorization
        ? await this.documentAggregationService.buildDocumentAggregate(domain.result.authorization)
        : null;

      const enrichedAct = domain.result.act
        ? await this.documentAggregationService.buildDocumentAggregate(domain.result.act)
        : null;

      // Создаем ResultOutputDTO с обогащенными документами
      enrichedResult = {
        ...domain.result,
        statement: enrichedStatement ? new DocumentAggregateDTO(enrichedStatement) : undefined,
        authorization: enrichedAuthorization ? new DocumentAggregateDTO(enrichedAuthorization) : undefined,
        act: enrichedAct ? new DocumentAggregateDTO(enrichedAct) : undefined,
      } as ResultOutputDTO;
    }

    // Возвращаем SegmentOutputDTO с обогащенными данными
    return {
      ...domain,
      display_name: displayName,
      value: contribution,
      result: enrichedResult,
    } as SegmentOutputDTO;
  }
}
