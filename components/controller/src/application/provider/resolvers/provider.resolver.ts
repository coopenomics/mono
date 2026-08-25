import { Resolver, Query, Args, Mutation, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProviderService } from '../services/provider.service';
import { ProviderSubscriptionDTO } from '../dto/provider-subscription.dto';
import { CurrentInstanceDTO } from '../dto/current-instance.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { CooperativeRegistryItemDTO } from '../dto/cooperative-registry-item.dto';
import { ProviderConnectionCatalogDTO } from '../dto/provider-catalog.dto';
import { CooperativeCharterService } from '../services/cooperative-charter.service';
import { CooperativeCharterOutputDTO } from '../dto/cooperative-charter.output';
import { UploadCooperativeCharterInputDTO } from '../dto/upload-cooperative-charter.input';
import { CooperativePaymentDTO } from '../dto/cooperative-payment.dto';
import { BillingPaymentLogService } from '~/infrastructure/billing/billing-payment-log.service';

@Resolver()
export class ProviderResolver {
  constructor(
    private readonly providerService: ProviderService,
    private readonly charters: CooperativeCharterService,
    private readonly payments: BillingPaymentLogService
  ) {}

  @Query(() => ProviderConnectionCatalogDTO, {
    name: 'getProviderConnectionCatalog',
    description:
      'Каталог витрины подключения (Epic 28): услуги и конфигурации сервера с живыми ценами провайдера',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman', 'user'])
  async getProviderConnectionCatalog(
    @Args('coopname', { nullable: true }) coopname?: string
  ): Promise<ProviderConnectionCatalogDTO> {
    return this.providerService.getConnectionCatalog(coopname ?? undefined);
  }

  @Query(() => [CooperativeRegistryItemDTO], {
    name: 'getCooperativesRegistry',
    description: 'Реестр кооперативов оператора: список кооперативов из блокчейна с данными провайдера (подписки, инстанс, биллинг)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getCooperativesRegistry(): Promise<CooperativeRegistryItemDTO[]> {
    return this.providerService.getCooperativesRegistry();
  }


  @Query(() => [CooperativePaymentDTO], {
    name: 'getCooperativePayments',
    description:
      'История оплат кооператива: списания подписок из журнала биллинга хаба, свежие сверху',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getCooperativePayments(
    @Args('coopname') coopname: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number
  ): Promise<CooperativePaymentDTO[]> {
    const rows = await this.payments.listByCoopname(coopname, limit ?? 50);
    return rows.map((row) => ({
      payment_hash: row.payment_hash,
      quantity: row.quantity,
      status: row.status,
      tx_id: row.tx_id ?? undefined,
      last_error: row.last_error ?? undefined,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));
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

  @Mutation(() => CooperativeCharterOutputDTO, {
    name: 'uploadCooperativeCharter',
    description: 'Приложить устав кооператива к заявке на подключение (бакет registrator:charters).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  // Устав прикладывает председатель подключающегося кооператива — в контуре
  // союза он обычный пайщик-организация, поэтому роль `user` обязательна.
  @AuthRoles(['member', 'chairman', 'user'])
  async uploadCooperativeCharter(
    @Args('data', { type: () => UploadCooperativeCharterInputDTO }) data: UploadCooperativeCharterInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<CooperativeCharterOutputDTO> {
    const { data: saved, readUrl } = await this.charters.upload(data, currentUser.username);
    return CooperativeCharterOutputDTO.fromDomain(saved, readUrl);
  }

  @Query(() => CooperativeCharterOutputDTO, {
    name: 'getCooperativeCharter',
    description: 'Последний устав кооператива со свежей ссылкой на скачивание.',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman', 'user'])
  async getCooperativeCharter(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('username', { type: () => String }) username: string
  ): Promise<CooperativeCharterOutputDTO | null> {
    const found = await this.charters.getLatest(coopname, username);
    return found ? CooperativeCharterOutputDTO.fromDomain(found.data, found.readUrl) : null;
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
