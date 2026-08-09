import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProviderService } from '../services/provider.service';
import { ProviderSubscriptionDTO } from '../dto/provider-subscription.dto';
import { CurrentInstanceDTO } from '../dto/current-instance.dto';
import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { RolesGuard } from '@coopenomics/extension-kit';
import { AuthRoles } from '@coopenomics/extension-kit';
import { CurrentUser } from '@coopenomics/extension-kit';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ConvertToAxonStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/convert-to-axon-statement-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { ProcessConvertToAxonStatementInputDTO } from '../dto/process-convert-to-axon-statement-input.dto';
import { Throttle } from '@nestjs/throttler';

@Resolver()
export class ProviderResolver {
  constructor(private readonly providerService: ProviderService) {}

  @Query(() => [ProviderSubscriptionDTO], {
    name: 'getProviderSubscriptions',
    description: 'Получить подписки пользователя у провайдера',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman', 'user'])
  async getProviderSubscriptions(
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<ProviderSubscriptionDTO[]> {
    return this.providerService.getUserSubscriptions(currentUser.username);
  }

  @Query(() => ProviderSubscriptionDTO, {
    name: 'getProviderSubscriptionById',
    description: 'Получить подписку провайдера по ID',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getProviderSubscriptionById(@Args('id') id: number): Promise<ProviderSubscriptionDTO> {
    return this.providerService.getSubscriptionById(id);
  }

  @Query(() => CurrentInstanceDTO, {
    name: 'getCurrentInstance',
    description: 'Получить текущий инстанс пользователя',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman', 'user'])
  async getCurrentInstance(@CurrentUser() currentUser: MonoAccountDomainInterface): Promise<CurrentInstanceDTO | null> {
    return this.providerService.getCurrentInstance(currentUser.username);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateConvertToAxonStatement',
    description: 'Генерирует заявление на конвертацию паевого взноса в членский взнос',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async generateConvertToAxonStatement(
    @Args('data', { type: () => ConvertToAxonStatementGenerateDocumentInputDTO })
    data: ConvertToAxonStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.providerService.generateConvertToAxonStatement(data, options);
  }

  @Mutation(() => Boolean, {
    name: 'processConvertToAxonStatement',
    description: 'Обрабатывает подписанное заявление на конвертацию и выполняет блокчейн-транзакцию',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async processConvertToAxonStatement(
    @Args('data', { type: () => ProcessConvertToAxonStatementInputDTO })
    data: ProcessConvertToAxonStatementInputDTO
  ): Promise<boolean> {
    return this.providerService.processConvertToAxonStatement(data);
  }
}
