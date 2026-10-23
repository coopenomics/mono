import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { GqlJwtAuthGuard, CurrentUser, RequireRight, RightsGuard, SELF } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { ChatCoopApplicationService } from '../services/chatcoop-application.service';
import { CreateMatrixAccountInputDTO, CheckMatrixUsernameInput } from '../dto/create-matrix-account.dto';
import { MatrixAccountStatusResponseDTO } from '../dto/matrix-account-status.dto';
@Resolver()
export class ChatCoopResolver {
  constructor(private readonly chatcoopAppService: ChatCoopApplicationService) {}

  @Query(() => MatrixAccountStatusResponseDTO, {
    name: 'chatcoopGetAccountStatus',
    description: 'Проверить статус Matrix аккаунта пользователя и получить iframe URL',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ChatAccount', 'manage:own', SELF)
  async getMatrixAccountStatus(
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<MatrixAccountStatusResponseDTO> {
    return this.chatcoopAppService.getMatrixAccountStatus(currentUser.username);
  }

  @Mutation(() => Boolean, {
    name: 'chatcoopCreateAccount',
    description: 'Создать Matrix аккаунт с именем пользователя и паролем',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ChatAccount', 'manage:own', SELF)
  async createMatrixAccount(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => CreateMatrixAccountInputDTO }) data: CreateMatrixAccountInputDTO
  ): Promise<boolean> {
    return this.chatcoopAppService.createMatrixAccount(currentUser.username, data.username, data.password);
  }

  @Query(() => Boolean, {
    name: 'chatcoopCheckUsernameAvailability',
    description: 'Проверяет доступность Matrix username',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ChatAccount', 'manage:own', SELF)
  async checkUsernameAvailability(
    @Args('data', { type: () => CheckMatrixUsernameInput }) data: CheckMatrixUsernameInput
  ): Promise<boolean> {
    return this.chatcoopAppService.checkUsernameAvailability(data.username);
  }
}
