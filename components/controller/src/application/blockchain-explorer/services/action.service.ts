import { Injectable } from '@nestjs/common';
import { GetActionsInteractor } from '../interactors/get-actions.interactor';
import type { ActionFilterDomainInterface } from '~/domain/parser/interfaces/parser-config-domain.interface';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { ActionFiltersInputDTO } from '../dto/action-filters-input.dto';
import { BlockchainActionDTO } from '~/application/common/dto/blockchain-action.dto';

/**
 * Сервис приложения для работы с действиями
 */
@Injectable()
export class ActionService {
  constructor(private readonly getActionsInteractor: GetActionsInteractor) {}

  /**
   * Получить действия с фильтрацией и пагинацией
   */
  async getActions(
    filters: ActionFiltersInputDTO = {},
    pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<BlockchainActionDTO>> {
    // Преобразование входных DTO в доменные интерфейсы
    const domainFilters: ActionFilterDomainInterface = {
      account: filters.account,
      name: filters.name,
      block_num: filters.block_num,
      global_sequence: filters.global_sequence,
    };

    const result = await this.getActionsInteractor.execute(domainFilters, pagination);

    // Преобразование результатов в DTO
    const items = result.items.map((action) => this.mapToDTO(action));

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Преобразование доменной сущности в DTO
   */
  private mapToDTO(action: ActionDomainInterface): BlockchainActionDTO {
    return new BlockchainActionDTO({
      transaction_id: action.transaction_id,
      account: action.account,
      block_num: action.block_num,
      block_id: action.block_id,
      chain_id: action.chain_id,
      name: action.name,
      receiver: action.receiver,
      authorization: action.authorization.map((auth) => ({
        actor: auth.actor,
        permission: auth.permission,
      })),
      data: action.data,
      action_ordinal: action.action_ordinal,
      global_sequence: action.global_sequence,
      account_ram_deltas: action.account_ram_deltas.map((delta) => ({
        account: delta.account,
        delta: delta.delta,
      })),
      console: action.console || '',
      receipt: {
        receiver: action.receipt.receiver,
        act_digest: action.receipt.act_digest,
        global_sequence: action.receipt.global_sequence,
        recv_sequence: action.receipt.recv_sequence,
        auth_sequence: action.receipt.auth_sequence.map((seq) => ({
          account: seq.account,
          sequence: seq.sequence,
        })),
        code_sequence: action.receipt.code_sequence,
        abi_sequence: action.receipt.abi_sequence,
      },
      creator_action_ordinal: action.creator_action_ordinal,
      context_free: action.context_free,
      elapsed: action.elapsed,
    });
  }
}
