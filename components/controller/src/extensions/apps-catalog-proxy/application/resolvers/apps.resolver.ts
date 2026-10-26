/**
 * GraphQL приложения «Приложения» (26.10.2026): витрина каталога, подписка и
 * отмена, переключатель, подписки и кошелёк узла у провайдера.
 *
 * Чтение — совету и председателю (`Apps:read`), действия — председателю
 * (`Apps:manage`). Пайщик видит страницы подключения у оператора по праву
 * `Connection:read:own`, их данные отдают резолверы ядра.
 */
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import { NodeAppsService } from '../services/node-apps.service';
import { AppsCatalogRemotePackageDTO } from '../dto/apps-catalog-remote-package.dto';
import { AppsNodeBillingDTO } from '../dto/apps-node-billing.dto';
import { SubscribePackageInputDTO } from '../dto/subscribe-package-input.dto';
import { SubscribePackageResultDTO } from '../dto/subscribe-package-result.dto';
import { SetCatalogAppEnabledInputDTO, UnsubscribePackageResultDTO } from '../dto/catalog-app-input.dto';

@Resolver()
export class AppsResolver {
  constructor(private readonly apps: NodeAppsService) {}

  @Query(() => [AppsCatalogRemotePackageDTO], {
    name: 'appsCatalogRemotePackages',
    description:
      'Приложения каталога для этого узла: цена и пробный срок у провайдера подключения, подписка кооператива, ' +
      'получен ли фронт и включено ли приложение. Пакет без цены у провайдера не показывается.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Apps', 'read')
  async appsCatalogRemotePackages(
    @Args('page', { type: () => Number, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Number, defaultValue: 50 }) pageSize: number,
  ): Promise<AppsCatalogRemotePackageDTO[]> {
    return this.apps.listCatalogApps(page, pageSize);
  }

  @Query(() => AppsNodeBillingDTO, {
    name: 'appsNodeBilling',
    description:
      'Подписки кооператива у провайдера подключения, сумма к оплате и кошелёк у оператора — только для показа. ' +
      'Пополнение и смена тарифа — на столе пайщика у оператора.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Apps', 'read')
  async appsNodeBilling(): Promise<AppsNodeBillingDTO> {
    return this.apps.nodeBilling();
  }

  @Mutation(() => SubscribePackageResultDTO, {
    name: 'subscribePackage',
    description:
      'Оформляет подписку кооператива на приложение из каталога у провайдера подключения. ' +
      'С пробным сроком из публикации подписка стартует пробной. Только председатель.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Apps', 'manage')
  async subscribePackage(
    @Args('data', { type: () => SubscribePackageInputDTO }) data: SubscribePackageInputDTO,
  ): Promise<SubscribePackageResultDTO> {
    return this.apps.subscribe(data.packageId);
  }

  @Mutation(() => UnsubscribePackageResultDTO, {
    name: 'unsubscribePackage',
    description: 'Отменяет подписку кооператива на приложение: строка счёта снимается, доступ к пакету закрывается.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Apps', 'manage')
  async unsubscribePackage(
    @Args('data', { type: () => SubscribePackageInputDTO }) data: SubscribePackageInputDTO,
  ): Promise<UnsubscribePackageResultDTO> {
    return this.apps.unsubscribe(data.packageId);
  }

  @Mutation(() => Boolean, {
    name: 'setCatalogAppEnabled',
    description: 'Включает или выключает приложение каталога на рабочем столе; подписка при этом не меняется.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Apps', 'manage')
  async setCatalogAppEnabled(
    @Args('data', { type: () => SetCatalogAppEnabledInputDTO }) data: SetCatalogAppEnabledInputDTO,
  ): Promise<boolean> {
    return this.apps.setEnabled(data.packageId, data.enabled);
  }
}
