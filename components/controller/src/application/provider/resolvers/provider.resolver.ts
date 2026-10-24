import { Resolver, Query, Args, Mutation, Int } from '@nestjs/graphql';
import { ProviderAppDTO, ProviderAppInputDTO } from '../dto/provider-app.dto';
import { UseGuards } from '@nestjs/common';
import { ProviderService } from '../services/provider.service';
import { ProviderSubscriptionDTO } from '../dto/provider-subscription.dto';
import { CurrentInstanceDTO } from '../dto/current-instance.dto';
import { DomainError, GqlJwtAuthGuard, CurrentUser, OptionalCurrentUser, RequireRight, RightsGuard, SELF } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { CooperativeRegistryItemDTO } from '../dto/cooperative-registry-item.dto';
import { ProviderConnectionCatalogDTO } from '../dto/provider-catalog.dto';
import { CooperativeCharterService } from '../services/cooperative-charter.service';
import { CooperativeCharterOutputDTO } from '../dto/cooperative-charter.output';
import { UploadCooperativeCharterInputDTO } from '../dto/upload-cooperative-charter.input';
import { CooperativePaymentDTO } from '../dto/cooperative-payment.dto';
import { ChangeHostingPlanResultDTO } from '../dto/change-hosting-plan.dto';
import {
  ChangeProviderTariffResultDTO,
  SelectProviderTariffInputDTO,
  SelectProviderTariffResultDTO,
} from '../dto/select-provider-tariff.dto';
import { BillingPaymentLogService } from '~/infrastructure/billing/billing-payment-log.service';
import { humanizeBillingError } from '~/domain/billing/utils/billing-error.utils';

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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderCatalog', 'read')
  async getProviderConnectionCatalog(
    // Необязательный: межсервисный вызов (server-secret) приходит без пользователя.
    @OptionalCurrentUser() currentUser: IMonoAccount | null,
    @Args('coopname', { nullable: true }) coopname?: string
  ): Promise<ProviderConnectionCatalogDTO> {
    const catalog = await this.providerService.getConnectionCatalog(coopname ?? undefined);
    // Выбор тарифа — дело самого кооператива: чужой видит только совет.
    // Межсервисный вызов (без пользователя) видит каталог целиком.
    const isBoard = !currentUser || currentUser.role === 'member' || currentUser.role === 'chairman';
    if (!isBoard && coopname !== currentUser?.username) catalog.current_tariff = null;
    return catalog;
  }

  @Query(() => [CooperativeRegistryItemDTO], {
    name: 'getCooperativesRegistry',
    description: 'Реестр кооперативов оператора: список кооперативов из блокчейна с данными провайдера (подписки, инстанс, биллинг)',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Union', 'read')
  async getCooperativesRegistry(): Promise<CooperativeRegistryItemDTO[]> {
    return this.providerService.getCooperativesRegistry();
  }


  @Query(() => [CooperativePaymentDTO], {
    name: 'getCooperativePayments',
    description:
      'История оплат кооператива: списания подписок из журнала биллинга хаба, свежие сверху',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderPayment', ['read:own', 'read:all'], SELF)
  async getCooperativePayments(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('coopname') coopname: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number
  ): Promise<CooperativePaymentDTO[]> {
    // Свой журнал доступен и кооперативу: у себя в кабинете он обычный пайщик
    // контура (роль user), а списания за его же подписки — его собственные
    // данные. Чужой журнал остаётся правом совета: для роли user имя берётся из
    // сессии, аргумент игнорируется — соседа посмотреть нельзя.
    const isBoard = currentUser.role === 'member' || currentUser.role === 'chairman';
    const targetCoopname = isBoard ? coopname : currentUser.username;
    const rows = await this.payments.listByCoopname(targetCoopname, limit ?? 50);
    return rows.map((row) => ({
      payment_hash: row.payment_hash,
      quantity: row.quantity,
      status: row.status,
      subject: row.subject ?? undefined,
      tx_id: row.tx_id ?? undefined,
      // Отказ узла приходит отладочным текстом контракта; пайщику показываем
      //понятную причину, сырое сообщение оставляем для сверки.
      reason: humanizeBillingError(row.last_error),
      last_error: row.last_error ?? undefined,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));
  }

  @Mutation(() => ChangeProviderTariffResultDTO, {
    name: 'changeProviderTariff',
    description:
      'Кооператив переходит на тариф подключения дороже: цены тарифа с зачётом остатка, при другом сервере — перенос (~час технических работ)',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderHostingPlan', 'change:own', SELF)
  async changeProviderTariff(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('tariffCode', { type: () => String }) tariffCode: string
  ): Promise<ChangeProviderTariffResultDTO> {
    // Только свой кооператив: имя из сессии, соседу тариф не сменить.
    return this.providerService.changeTariff(currentUser.username, tariffCode);
  }

  @Mutation(() => SelectProviderTariffResultDTO, {
    name: 'selectProviderTariff',
    description:
      'Кооператив выбирает тариф подключения: провайдер по нему заказывает сервер и заводит подписки',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderTariff', 'select:own', SELF)
  async selectProviderTariff(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => SelectProviderTariffInputDTO }) data: SelectProviderTariffInputDTO
  ): Promise<SelectProviderTariffResultDTO> {
    // Только за себя: кооператив-кандидат подключается под своим именем,
    // и выбрать тариф соседу нельзя — имя берётся из сессии.
    return this.providerService.selectTariff(currentUser.username, data.tariff_code, data.billing_period);
  }

  @Mutation(() => ChangeHostingPlanResultDTO, {
    name: 'changeProviderHostingPlan',
    description:
      'Кооператив переходит на тариф сервера дороже: цена применяется немедленно с зачётом остатка, запускается перенос (~час технических работ)',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderHostingPlan', 'change:own', SELF)
  async changeProviderHostingPlan(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('instanceTypeId', { type: () => Int }) instanceTypeId: number
  ): Promise<ChangeHostingPlanResultDTO> {
    // Только свой кооператив: имя берётся из сессии, а не из аргументов —
    // председатель не может сменить тариф соседу.
    return this.providerService.changeHostingPlan(currentUser.username, instanceTypeId);
  }

  @Query(() => [ProviderAppDTO], {
    name: 'getProviderApps',
    description: 'Приложения каталога, которые кооператив может подключить, и его подписки на них',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderApp', 'read:own', SELF)
  async getProviderApps(@CurrentUser() currentUser: IMonoAccount): Promise<ProviderAppDTO[]> {
    return this.providerService.listApps(currentUser.username);
  }

  @Mutation(() => ProviderAppDTO, {
    name: 'subscribeProviderApp',
    description: 'Подключить приложение каталога: подписка входит в общий счёт кооператива у провайдера',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderApp', 'subscribe:own', SELF)
  async subscribeProviderApp(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => ProviderAppInputDTO }) data: ProviderAppInputDTO,
  ): Promise<ProviderAppDTO> {
    // Только за себя: имя кооператива из сессии.
    await this.providerService.subscribeApp(currentUser.username, data.package_id);
    return this.appOf(currentUser.username, data.package_id);
  }

  @Mutation(() => ProviderAppDTO, {
    name: 'cancelProviderApp',
    description: 'Отключить приложение каталога: подписка отменяется, приложение снимается с узла кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderApp', 'subscribe:own', SELF)
  async cancelProviderApp(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => ProviderAppInputDTO }) data: ProviderAppInputDTO,
  ): Promise<ProviderAppDTO> {
    await this.providerService.cancelApp(currentUser.username, data.package_id);
    return this.appOf(currentUser.username, data.package_id);
  }

  /** Строка карточки после действия — тем же чтением, что и список. */
  private async appOf(username: string, packageId: string): Promise<ProviderAppDTO> {
    const app = (await this.providerService.listApps(username)).find((a) => a.package_id === packageId);
    if (!app) throw DomainError.badRequest('PROVIDER_APP_NOT_OFFERED', { package_id: packageId });
    return app;
  }

  @Query(() => [ProviderSubscriptionDTO], {
    name: 'getProviderSubscriptions',
    description: 'Получить подписки пользователя у провайдера',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderSubscription', 'read:own', SELF)
  async getProviderSubscriptions(
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ProviderSubscriptionDTO[]> {
    return this.providerService.getUserSubscriptions(currentUser.username);
  }

  @Query(() => ProviderSubscriptionDTO, {
    name: 'getProviderSubscriptionById',
    description: 'Получить подписку провайдера по ID',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderSubscription', 'read:all')
  async getProviderSubscriptionById(@Args('id') id: number): Promise<ProviderSubscriptionDTO> {
    return this.providerService.getSubscriptionById(id);
  }

  @Mutation(() => CooperativeCharterOutputDTO, {
    name: 'uploadCooperativeCharter',
    description: 'Приложить устав кооператива к заявке на подключение (бакет registrator:charters).',
  })
  // Устав прикладывает председатель подключающегося кооператива — в контуре
  // союза он обычный пайщик-организация (кандидат до приёма), поэтому право
  // выдано любому вошедшему на своё имя.
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CooperativeCharter', 'upload:own', SELF)
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
  // Свой устав читает кооператив, чужой — совет (карточка реестра кооперативов).
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CooperativeCharter', ['read:own', 'read:all'], { owner: 'username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ProviderSubscription', 'read:own', SELF)
  async getCurrentInstance(@CurrentUser() currentUser: IMonoAccount): Promise<CurrentInstanceDTO | null> {
    return this.providerService.getCurrentInstance(currentUser.username);
  }
}
