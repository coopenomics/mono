import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { ProjectTypeormEntity } from '../entities/project.typeorm-entity';
import type { IProjectDomainInterfaceDatabaseData } from '../../domain/interfaces/project-database.interface';
import type { IProjectDomainInterfaceBlockchainData } from '../../domain/interfaces/project-blockchain.interface';
import type { ProjectStatus } from '../../domain/enums/project-status.enum';
import { ProjectOrigin } from '../../domain/enums/project-origin.enum';
import { ProjectPriority } from '../../domain/enums/project-priority.enum';
import {
  normalizeProjectCounts,
  normalizeProjectCrps,
  normalizeProjectFact,
  normalizeProjectPlan,
  normalizeProjectVoting,
} from '../../domain/utils/empty-project-blockchain-pools';
import type { RequireFields } from '@coopenomics/extension-kit';

type toEntityDatabasePart = RequireFields<Partial<ProjectTypeormEntity>, keyof IProjectDomainInterfaceDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ProjectTypeormEntity>, keyof IProjectDomainInterfaceBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ProjectDomainEntity>, keyof IProjectDomainInterfaceDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ProjectDomainEntity>, keyof IProjectDomainInterfaceBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью проекта и TypeORM сущностью
 */
export class ProjectMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ProjectTypeormEntity): ProjectDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      project_hash: entity.project_hash,
      status: entity.status,
      blockchain_status: entity.blockchain_status,
      prefix: entity.prefix,
      issue_counter: entity.issue_counter,
      voting_deadline: entity.voting_deadline,
      matrix_room_id: entity.matrix_room_id ?? null,
      matrix_component_announcement_events: entity.matrix_component_announcement_events ?? [],
      development_repository_url: entity.development_repository_url ?? null,
      priority: entity.priority ?? ProjectPriority.MEDIUM,
      content_rev: entity.content_rev ?? 0,
      origin: entity.origin ?? ProjectOrigin.BLOCKCHAIN,
      local_owner: entity.local_owner ?? null,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };


    let blockchainData: toDomainBlockchainPart | undefined;

    // Колонки title/master лежат в PG и для LOCAL (без blockchain id)
    if (entity.id != null || entity.origin === ProjectOrigin.LOCAL || (entity.title && entity.master)) {
      const blockchainId = entity.id != null && entity.id > 0 ? entity.id : 0;
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: blockchainId,
        coopname: entity.coopname,
        project_hash: entity.project_hash,
        parent_hash: entity.parent_hash || '',
        status: entity.status,
        is_opened: entity.is_opened,
        is_planed: entity.is_planed,
        is_authorized: entity.is_authorized,
        master: entity.master,
        title: entity.title,
        description: entity.description,
        invite: entity.invite,
        data: entity.data,
        meta: entity.meta || '',
        authorization: entity.authorization,
        counts: normalizeProjectCounts(entity.counts),
        plan: normalizeProjectPlan(entity.plan),
        fact: normalizeProjectFact(entity.fact),
        crps: normalizeProjectCrps(entity.crps),
        voting: normalizeProjectVoting(entity.voting),
        created_at: entity.created_at
          ? entity.created_at.toISOString()
          : new Date().toISOString(),
        _created_at: entity._created_at,
        _updated_at: entity._updated_at,
      } as toDomainBlockchainPart;
    }

    return new ProjectDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ProjectDomainEntity): Partial<ProjectTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      project_hash: domain.project_hash,
      status: domain.status,
      blockchain_status: domain.blockchain_status as string,
      prefix: domain.prefix,
      issue_counter: domain.issue_counter,
      voting_deadline: domain.voting_deadline,
      matrix_room_id: domain.matrix_room_id ?? null,
      matrix_component_announcement_events: domain.matrix_component_announcement_events ?? null,
      development_repository_url: domain.development_repository_url ?? null,
      priority: domain.priority ?? ProjectPriority.MEDIUM,
      // 0 не пишем (undefined TypeORM пропускает): номер редакции двигает только ContentRevisionService
      content_rev: (domain.content_rev || undefined) as number,
      origin: domain.origin ?? ProjectOrigin.BLOCKCHAIN,
      local_owner: domain.local_owner ?? null,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain.id != null || domain.origin === ProjectOrigin.LOCAL || (domain.title && domain.master)) {
      blockchainPart = {
        id: domain.id != null && domain.id > 0 ? domain.id : null,
        coopname: domain.coopname as string,
        project_hash: domain.project_hash as string,
        parent_hash: domain.parent_hash as string,
        status: domain.status as ProjectStatus,
        is_opened: domain.is_opened as boolean,
        is_planed: domain.is_planed as boolean,
        is_authorized: domain.is_authorized as boolean,
        master: domain.master as string,
        title: domain.title as string,
        description: domain.description as string,
        invite: domain.invite as string,
        data: domain.data as string,
        meta: domain.meta as string,
        authorization: domain.authorization as IProjectDomainInterfaceBlockchainData['authorization'],
        counts: domain.counts as IProjectDomainInterfaceBlockchainData['counts'],
        plan: domain.plan as IProjectDomainInterfaceBlockchainData['plan'],
        fact: domain.fact as IProjectDomainInterfaceBlockchainData['fact'],
        crps: domain.crps as IProjectDomainInterfaceBlockchainData['crps'],
        voting: domain.voting as IProjectDomainInterfaceBlockchainData['voting'],
        created_at: new Date(domain.created_at ?? new Date()),
        _created_at: domain._created_at as Date,
        _updated_at: domain._updated_at as Date,
      } as toEntityBlockchainPart;
    }

    return { ...dbPart, ...blockchainPart };
  }

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<ProjectDomainEntity>): Partial<ProjectTypeormEntity> {
    const updateData: Partial<ProjectTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain._id !== undefined) updateData._id = domain._id;
    if (domain.id !== undefined) updateData.id = domain.id;
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    // Примечание: Все поля из блокчейна (coopname, project_hash, status, counts, plan, fact, crps, voting, membership)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }
}
