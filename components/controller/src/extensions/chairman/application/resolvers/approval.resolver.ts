import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { ApprovalService } from '../services/approval.service';
import { ApprovalFilterInput } from '../dto/approval-filter.input';
import { ConfirmApproveInputDTO } from '../dto/confirm-approve-input.dto';
import { DeclineApproveInputDTO } from '../dto/decline-approve-input.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser, createPaginationResult, PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { IMonoAccount } from '@coopenomics/innercoop';
import { ApprovalDTO } from '../dto/approval.dto';

// Пагинированные результаты
const paginatedApprovalsResult = createPaginationResult(ApprovalDTO, 'PaginatedChairmanApprovals');

/**
 * GraphQL резолвер для действий управления одобрениями CHAIRMAN
 */
@Resolver()
export class ApprovalResolver {
  constructor(private readonly approvalService: ApprovalService) {}

  // ============ ЗАПРОСЫ ОДОБРЕНИЙ ============

  /**
   * Получение всех одобрений с фильтрацией
   */
  @Query(() => paginatedApprovalsResult, {
    name: 'chairmanApprovals',
    description: 'Получение списка одобрений председателя совета с фильтрацией',
  })
  async getApprovals(
    @Args('filter', { nullable: true }) filter?: ApprovalFilterInput,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ApprovalDTO>> {
    // Конвертируем параметры пагинации в доменный формат
    const domainOptions: PaginationInputDTO | undefined = options
      ? {
          page: options.page,
          limit: options.limit,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
        }
      : undefined;

    // Сервис возвращает полный пагинированный результат с DTO
    return await this.approvalService.getApprovals(filter, domainOptions);
  }

  /**
   * Получение одобрения по ID
   */
  @Query(() => ApprovalDTO, {
    name: 'chairmanApproval',
    description: 'Получение одобрения по внутреннему ID базы данных',
    nullable: true,
  })
  async getApproval(@Args('id') id: string): Promise<ApprovalDTO | null> {
    return await this.approvalService.getApprovalById(id);
  }

  // ============ МУТАЦИИ ОДОБРЕНИЙ ============

  /**
   * Мутация для подтверждения одобрения
   */
  @Mutation(() => ApprovalDTO, {
    name: 'chairmanConfirmApprove',
    description: 'Подтверждение одобрения документа председателем совета',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async confirmApprove(
    @Args('data', { type: () => ConfirmApproveInputDTO }) data: ConfirmApproveInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ApprovalDTO> {
    return await this.approvalService.confirmApprove(data, currentUser.username);
  }

  /**
   * Мутация для отклонения одобрения
   */
  @Mutation(() => ApprovalDTO, {
    name: 'chairmanDeclineApprove',
    description: 'Отклонение одобрения документа председателем совета',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async declineApprove(
    @Args('data', { type: () => DeclineApproveInputDTO }) data: DeclineApproveInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ApprovalDTO> {
    return await this.approvalService.declineApprove(data, currentUser.username);
  }
}
