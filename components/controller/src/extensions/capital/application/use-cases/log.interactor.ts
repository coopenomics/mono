import { Injectable } from '@nestjs/common';
import { LogService, ICapitalLogFilterInput } from '../services/log.service';
import { LogOutputDTO } from '../dto/logs/log.dto';
import { GetLogsInputDTO } from '../dto/logs/get-logs.input';
import { PaginationResult, PaginationInputDTO } from '@coopenomics/extension-kit';

/**
 * Интерактор для работы с логами
 * Обрабатывает бизнес-логику для получения логов событий
 */
@Injectable()
export class LogInteractor {
  constructor(private readonly logService: LogService) {}

  /**
   * Получение логов с фильтрацией и пагинацией
   */
  async getLogs(input: GetLogsInputDTO, viewerUsername?: string): Promise<PaginationResult<LogOutputDTO>> {
    const { filter, pagination } = input;

    const serviceFilter: ICapitalLogFilterInput = {
      coopname: filter?.coopname,
      project_hash: filter?.project_hash,
      issue_hash: filter?.issue_hash,
      show_issue_logs: filter?.show_issue_logs,
      initiator: filter?.initiator,
      date_from: filter?.date_from,
      date_to: filter?.date_to,
      show_components_logs: filter?.show_components_logs,
      viewer_username: viewerUsername,
    };

    const domainOptions: PaginationInputDTO | undefined = pagination;
    const result = await this.logService.getLogs(serviceFilter, domainOptions);
    const items = result.items.map((log) => this.mapToDTO(log));

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение логов по хешу проекта
   */
  async getLogsByProjectHash(
    project_hash: string,
    pagination?: PaginationInputDTO,
    viewerUsername?: string
  ): Promise<PaginationResult<LogOutputDTO>> {
    const domainOptions: PaginationInputDTO | undefined = pagination;
    const result = await this.logService.getLogsByProjectHash(project_hash, domainOptions, viewerUsername);
    const items = result.items.map((log) => this.mapToDTO(log));

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение логов по хешу задачи
   */
  async getLogsByIssueHash(
    issue_hash: string,
    pagination?: PaginationInputDTO,
    viewerUsername?: string
  ): Promise<PaginationResult<LogOutputDTO>> {
    const domainOptions: PaginationInputDTO | undefined = pagination;
    const result = await this.logService.getLogsByIssueHash(issue_hash, domainOptions, viewerUsername);
    const items = result.items.map((log) => this.mapToDTO(log));

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение лога по ID
   */
  async getLogById(id: string): Promise<LogOutputDTO | null> {
    const log = await this.logService.getLogById(id);
    return log ? this.mapToDTO(log) : null;
  }

  /**
   * Маппинг доменной сущности в DTO
   */
  private mapToDTO(log: any): LogOutputDTO {
    return {
      _id: log._id,
      coopname: log.coopname,
      project_hash: log.project_hash,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      event_type: log.event_type,
      initiator: log.initiator,
      actor_name: log.actor_name ?? log.initiator,
      title: log.title ?? log.message,
      description: log.description,
      reference_id: log.reference_id,
      metadata: log.metadata,
      message: log.message,
      created_at: log.created_at,
    };
  }
}
