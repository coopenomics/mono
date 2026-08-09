import { Injectable, Inject } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ApprovalDomainEntity } from '../../domain/entities/approval.entity';
import { ApprovalRepository, APPROVAL_REPOSITORY } from '../../domain/repositories/approval.repository';
import { ApprovalFilterInput } from '../dto/approval-filter.input';
import { ConfirmApproveInputDTO } from '../dto/confirm-approve-input.dto';
import { DeclineApproveInputDTO } from '../dto/decline-approve-input.dto';
import { ApprovalDTO } from '../dto/approval.dto';
import { ChairmanBlockchainAdapter } from '../../infrastructure/blockchain/adapters/chairman-blockchain.adapter';
import { CHAIRMAN_BLOCKCHAIN_PORT } from '../../domain/interfaces/chairman-blockchain.port';
import { DocumentAggregationService } from '~/domain/document/services/document-aggregation.service';
import { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { PaginationResult } from '@coopenomics/extension-kit';
import { ConfirmApproveDomainInput } from '../../domain/actions/confirm-approve-domain-input.interface';
import { DeclineApproveDomainInput } from '../../domain/actions/decline-approve-domain-input.interface';

/**
 * Сервис для работы с одобрениями
 */
@Injectable()
export class ApprovalService {
  constructor(
    @Inject(APPROVAL_REPOSITORY)
    private readonly approvalRepository: ApprovalRepository,
    @Inject(CHAIRMAN_BLOCKCHAIN_PORT)
    private readonly blockchainAdapter: ChairmanBlockchainAdapter,
    private readonly logger: WinstonLoggerService,
    private readonly documentAggregationService: DocumentAggregationService
  ) {
    this.logger.setContext(ApprovalService.name);
  }

  /**
   * Получить все одобрения с пагинацией и фильтрацией
   */
  async getApprovals(
    filter?: ApprovalFilterInput,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResult<ApprovalDTO>> {
    this.logger.debug('Получение списка одобрений', { filter, options });

    // Получаем пагинированный результат из репозитория
    const result = await this.approvalRepository.findAllPaginated(filter, options);

    // Преобразуем в DTO
    const items = await this.toDTOs(result.items);

    // Возвращаем полный пагинированный результат
    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получить одобрение по ID
   */
  async getApprovalById(id: string): Promise<ApprovalDTO | null> {
    this.logger.debug('Получение одобрения по ID', { id });
    const entity = await this.approvalRepository.findById(id);
    return entity ? await this.toDTO(entity) : null;
  }

  /**
   * Подтвердить одобрение
   */
  async confirmApprove(input: ConfirmApproveInputDTO, username: string): Promise<ApprovalDTO> {
    this.logger.info('Подтверждение одобрения', { approval_hash: input.approval_hash });

    // Найти одобрение в базе данных
    const approval = await this.approvalRepository.findBySyncKey('approval_hash', input.approval_hash);
    if (!approval) {
      throw new Error(`Одобрение с хешем ${input.approval_hash} не найдено`);
    }

    // Создать доменный объект для блокчейн действия
    const domainData: ConfirmApproveDomainInput = {
      coopname: input.coopname,
      username,
      approval_hash: input.approval_hash,
      approved_document: input.approved_document,
    };
    console.log('domainData', domainData)
    // Вызвать блокчейн действие
    await this.blockchainAdapter.confirmApprove(domainData);

    // Обновить статус одобрения и сохранить одобренный документ
    approval.approve(input.approved_document);
    const updatedApproval = await this.approvalRepository.save(approval);

    this.logger.info('Одобрение успешно подтверждено', { approval_hash: input.approval_hash });
    return await this.toDTO(updatedApproval);
  }

  /**
   * Отклонить одобрение
   */
  async declineApprove(input: DeclineApproveInputDTO, username: string): Promise<ApprovalDTO> {
    this.logger.info('Отклонение одобрения', { approval_hash: input.approval_hash });

    // Найти одобрение в базе данных
    const approval = await this.approvalRepository.findBySyncKey('approval_hash', input.approval_hash);
    if (!approval) {
      throw new Error(`Одобрение с хешем ${input.approval_hash} не найдено`);
    }

    // Создать доменный объект для блокчейн действия
    const domainData: DeclineApproveDomainInput = {
      coopname: input.coopname,
      username,
      approval_hash: input.approval_hash,
      reason: input.reason,
    };

    // Вызвать блокчейн действие
    await this.blockchainAdapter.declineApprove(domainData);

    // Обновить статус одобрения
    approval.decline();
    const updatedApproval = await this.approvalRepository.save(approval);

    this.logger.info('Одобрение успешно отклонено', { approval_hash: input.approval_hash });
    return await this.toDTO(updatedApproval);
  }

  /**
   * Преобразовать доменную сущность в DTO
   */
  private async toDTO(entity: ApprovalDomainEntity): Promise<ApprovalDTO> {
    // Преобразуем документы в агрегаты
    const document = await this.documentAggregationService.buildDocumentAggregate(entity.document);
    const approved_document = entity.approved_document
      ? await this.documentAggregationService.buildDocumentAggregate(entity.approved_document)
      : null;

    return {
      _id: entity._id,
      present: entity.present,
      block_num: entity.block_num,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      id: entity.id,
      coopname: entity.coopname,
      username: entity.username,
      approval_hash: entity.approval_hash,
      callback_contract: entity.callback_contract,
      callback_action_approve: entity.callback_action_approve,
      callback_action_decline: entity.callback_action_decline,
      meta: entity.meta,
      created_at: entity.created_at,
      status: entity.status,
      document,
      approved_document,
    };
  }

  /**
   * Преобразовать массив доменных сущностей в массив DTO
   */
  private async toDTOs(entities: ApprovalDomainEntity[]): Promise<ApprovalDTO[]> {
    return await Promise.all(entities.map((entity) => this.toDTO(entity)));
  }
}
