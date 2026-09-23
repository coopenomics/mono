import { Injectable, Inject, Optional } from '@nestjs/common';
import { SovietContract } from 'cooptypes';
import {
  CHAIN_DELTA_WAIT_PORT,
  DOCUMENT_PORT,
  LOGGER_PORT,
  type IChainDeltaWaitPort,
  type IDocumentPort,
  type ILoggerPort,
} from '@coopenomics/innercoop';
import { ApprovalDomainEntity } from '../../domain/entities/approval.entity';
import { ApprovalRepository, APPROVAL_REPOSITORY } from '../../domain/repositories/approval.repository';
import { ApprovalFilterInput } from '../dto/approval-filter.input';
import { ConfirmApproveInputDTO } from '../dto/confirm-approve-input.dto';
import { DeclineApproveInputDTO } from '../dto/decline-approve-input.dto';
import { ApprovalDTO } from '../dto/approval.dto';
import { ChairmanBlockchainAdapter } from '../../infrastructure/blockchain/adapters/chairman-blockchain.adapter';
import { CHAIRMAN_BLOCKCHAIN_PORT } from '../../domain/interfaces/chairman-blockchain.port';
import { PaginationResult, PaginationInputDTO } from '@coopenomics/extension-kit';
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
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Optional() @Inject(CHAIN_DELTA_WAIT_PORT) private readonly chainWait: IChainDeltaWaitPort | null = null
  ) {
    this.logger.setContext(ApprovalService.name);
  }

  /**
   * Решение по одобрению отвечает после факта из цепи (ADR-009): ждём, пока
   * придут и лягут в базу изменение самого одобрения и изменение
   * контракта-адресата (договор преподавателя, приложение к проекту…) — они
   * в том же блоке. Тогда стол, где подписали, сразу видит новое состояние,
   * без выдуманных пауз. Не дождались — отвечаем как раньше, интерфейс
   * догонит при следующем чтении.
   */
  private async awaitDecisionApplied(tx: unknown, approval: ApprovalDomainEntity): Promise<void> {
    if (!this.chainWait) return;
    const hash = approval.approval_hash.toLowerCase();
    const applied = await this.chainWait.afterTransact(tx, [
      {
        code: SovietContract.contractName.production,
        table: SovietContract.Tables.Approvals.tableName,
        scope: approval.coopname,
        match: (d) => !d.value?.approval_hash || String(d.value.approval_hash).toLowerCase() === hash,
      },
      ...(approval.callback_contract ? [{ code: approval.callback_contract, scope: approval.coopname }] : []),
    ]);
    if (!applied) {
      this.logger.warn('Решение по одобрению отправлено, но изменение из цепи не пришло в срок — ответ без ожидания', {
        approval_hash: hash,
      });
    }
  }


  /**
   * Получить все одобрения с пагинацией и фильтрацией
   */
  async getApprovals(
    filter?: ApprovalFilterInput,
    options?: PaginationInputDTO
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
    const tx = await this.blockchainAdapter.confirmApprove(domainData);
    await this.awaitDecisionApplied(tx, approval);

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
    const tx = await this.blockchainAdapter.declineApprove(domainData);
    await this.awaitDecisionApplied(tx, approval);

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
    const document = await this.documentPort.buildAggregate(entity.document);
    const approved_document = entity.approved_document
      ? await this.documentPort.buildAggregate(entity.approved_document)
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
