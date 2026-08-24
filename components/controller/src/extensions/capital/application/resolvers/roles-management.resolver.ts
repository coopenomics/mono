import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthRoles, GqlJwtAuthGuard, RolesGuard, TransactionDTO } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { CurrentUser } from '@coopenomics/extension-kit';
import { RolesManagementService } from '../services/roles-management.service';
import {
  AcceptProjectRoleInviteInputDTO,
  ApproveProjectRoleInputDTO,
  DeclineProjectRoleInputDTO,
  DeclineProjectRoleInviteInputDTO,
  InviteProjectRoleInputDTO,
  RequestProjectRoleInputDTO,
  RequestRateUpdateInputDTO,
} from '../dto/roles_management/inputs.dto';

/**
 * Допуск пайщика к роли на компоненте и утверждение ставки часа.
 *
 * Допуск оформляется без юридического документа: заявка, приглашение и решение
 * по ним фиксируются подписью операции. Ставка часа, утверждённая мастером,
 * действует на этом компоненте и не меняется правкой личной ставки в профиле.
 */
@Resolver()
export class RolesManagementResolver {
  constructor(private readonly rolesManagementService: RolesManagementService) {}

  @Mutation(() => TransactionDTO, {
    name: 'capitalRequestProjectRole',
    description: 'Подать заявку на допуск к роли на компоненте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async requestProjectRole(
    @Args('data', { type: () => RequestProjectRoleInputDTO }) data: RequestProjectRoleInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return await this.rolesManagementService.requestProjectRole(data, currentUser?.username);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalApproveProjectRole',
    description: 'Одобрить заявку на допуск к роли или новую ставку часа',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async approveProjectRole(
    @Args('data', { type: () => ApproveProjectRoleInputDTO }) data: ApproveProjectRoleInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return await this.rolesManagementService.approveProjectRole(data, currentUser?.username);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalDeclineProjectRole',
    description: 'Отказать по заявке на допуск к роли или новую ставку часа',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async declineProjectRole(
    @Args('data', { type: () => DeclineProjectRoleInputDTO }) data: DeclineProjectRoleInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return await this.rolesManagementService.declineProjectRole(data, currentUser?.username);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalInviteProjectRole',
    description: 'Пригласить пайщика на роль на компоненте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async inviteProjectRole(
    @Args('data', { type: () => InviteProjectRoleInputDTO }) data: InviteProjectRoleInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return await this.rolesManagementService.inviteProjectRole(data, currentUser?.username);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalAcceptProjectRoleInvite',
    description: 'Принять приглашение на роль на компоненте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async acceptProjectRoleInvite(
    @Args('data', { type: () => AcceptProjectRoleInviteInputDTO }) data: AcceptProjectRoleInviteInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return await this.rolesManagementService.acceptProjectRoleInvite(data, currentUser?.username);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalDeclineProjectRoleInvite',
    description: 'Отказаться от приглашения на роль на компоненте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async declineProjectRoleInvite(
    @Args('data', { type: () => DeclineProjectRoleInviteInputDTO }) data: DeclineProjectRoleInviteInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return await this.rolesManagementService.declineProjectRoleInvite(data, currentUser?.username);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalRequestRateUpdate',
    description: 'Подать заявку на изменение утверждённой ставки часа',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async requestRateUpdate(
    @Args('data', { type: () => RequestRateUpdateInputDTO }) data: RequestRateUpdateInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return await this.rolesManagementService.requestRateUpdate(data, currentUser?.username);
  }
}
