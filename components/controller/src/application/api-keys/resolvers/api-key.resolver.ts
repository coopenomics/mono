import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ApiKeyService } from '~/infrastructure/api-keys/api-key.service';
import { CreateApiKeyInputDTO, ApiKeyCreatedDTO, ApiKeyInfoDTO } from '../dto/api-key.dto';
import { config } from '~/config';

@Resolver()
export class ApiKeyResolver {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Mutation(() => ApiKeyCreatedDTO, {
    name: 'createApiKey',
    description: 'Создать API ключ кооператива. Полный ключ показывается только при создании.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async createApiKey(
    @Args('data') data: CreateApiKeyInputDTO,
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<ApiKeyCreatedDTO> {
    return this.apiKeyService.createKey({
      coopname: config.coopname,
      name: data.name,
      createdBy: user.username,
      allowedOperations: data.allowedOperations,
      expiresInDays: data.expiresInDays,
    });
  }

  @Query(() => [ApiKeyInfoDTO], {
    name: 'getApiKeys',
    description: 'Получить список API ключей кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getApiKeys(): Promise<ApiKeyInfoDTO[]> {
    return this.apiKeyService.listKeys(config.coopname) as any;
  }

  @Mutation(() => Boolean, {
    name: 'revokeApiKey',
    description: 'Отозвать API ключ',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async revokeApiKey(
    @Args('id') id: string,
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<boolean> {
    await this.apiKeyService.revokeKey(id, user.username);
    return true;
  }
}
