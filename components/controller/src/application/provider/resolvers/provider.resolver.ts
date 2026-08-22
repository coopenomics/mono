import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProviderService } from '../services/provider.service';
import { ProviderSubscriptionDTO } from '../dto/provider-subscription.dto';
import { CurrentInstanceDTO } from '../dto/current-instance.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { CooperativeRegistryItemDTO } from '../dto/cooperative-registry-item.dto';

@Resolver()
export class ProviderResolver {
  constructor(private readonly providerService: ProviderService) {}

  @Query(() => [CooperativeRegistryItemDTO], {
    name: 'getCooperativesRegistry',
    description: 'Реестр кооперативов оператора: список кооперативов из блокчейна с данными провайдера (подписки, инстанс, биллинг)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getCooperativesRegistry(): Promise<CooperativeRegistryItemDTO[]> {
    return this.providerService.getCooperativesRegistry();
  }

  @Query(() => [ProviderSubscriptionDTO], {
    name: 'getProviderSubscriptions',
    description: 'Получить подписки пользователя у провайдера',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman', 'user'])
  async getProviderSubscriptions(
    @CurrentUser() currentUser: IMonoAccount
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
  async getCurrentInstance(@CurrentUser() currentUser: IMonoAccount): Promise<CurrentInstanceDTO | null> {
    return this.providerService.getCurrentInstance(currentUser.username);
  }
}
