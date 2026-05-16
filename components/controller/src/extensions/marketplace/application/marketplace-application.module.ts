import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketplaceExtensionDomainModule } from '../domain/marketplace-domain.module';
import { CategoryTreeResolver } from './resolvers/category-tree.resolver';
import { AttributeResolver } from './resolvers/attribute.resolver';
import { AvailableCategoryAdminResolver } from './resolvers/available-category-admin.resolver';
import { RequestResolver } from './resolvers/request.resolver';
import { MarketplaceMembershipResolver } from './resolvers/marketplace-membership.resolver';
import { KuDetailsResolver } from './resolvers/ku-details.resolver';
import { MarketplaceOnboardingResolver } from './resolvers/marketplace-onboarding.resolver';
import { MarketplaceMemberWalletResolver } from './resolvers/marketplace-member-wallet.resolver';
import { MarketplaceCoopAcceptanceResolver } from './resolvers/marketplace-coop-acceptance.resolver';
import { MarketplaceRegistrationOfferResolver } from './resolvers/marketplace-registration-offer.resolver';
import { MarketplaceWhitelistResolver } from './resolvers/marketplace-whitelist.resolver';
import { MarketplaceVitrineResolver } from './resolvers/marketplace-vitrine.resolver';
import { MarketplaceOfferResolver } from './resolvers/marketplace-offer.resolver';
import { MarketplaceModerationResolver } from './resolvers/marketplace-moderation.resolver';
import { MarketplaceCatalogResolver } from './resolvers/marketplace-catalog.resolver';
import { MarketplaceOrderResolver } from './resolvers/marketplace-order.resolver';
import { MarketplaceCycleResolver } from './resolvers/marketplace-cycle.resolver';
import { MarketplaceMembershipGuard } from './guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from './guards/marketplace-role.guard';
import { MarketplaceOnboardingService } from './onboarding/marketplace-onboarding.service';
import { MarketplaceCoopAcceptanceService } from './coop-acceptance/marketplace-coop-acceptance.service';
import { CategoryTreeService, CATEGORY_TREE_SERVICE } from './services/category-tree.service';
import { KuDetailsService } from './services/ku-details.service';
import {
  MarketplaceWhitelistService,
  MARKETPLACE_WHITELIST_SERVICE,
} from './services/marketplace-whitelist.service';
import {
  MarketplaceVitrineService,
  MARKETPLACE_VITRINE_SERVICE,
} from './services/marketplace-vitrine.service';
import {
  MarketplaceOfferService,
  MARKETPLACE_OFFER_SERVICE,
} from './services/marketplace-offer.service';
import {
  MarketplaceCategoryService,
  MARKETPLACE_CATEGORY_SERVICE,
} from './services/marketplace-category.service';
import {
  MarketplaceModerationService,
  MARKETPLACE_MODERATION_SERVICE,
} from './services/marketplace-moderation.service';
import {
  MarketplaceOfferCountersService,
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
} from './services/marketplace-offer-counters.service';
import {
  MarketplaceOrderCreateService,
  MARKETPLACE_ORDER_CREATE_SERVICE,
} from './services/marketplace-order-create.service';
import { marketplaceAssetConfigProvider } from './services/marketplace-asset.config.provider';
import {
  MarketplaceOrderCancelService,
  MARKETPLACE_ORDER_CANCEL_SERVICE,
} from './services/marketplace-order-cancel.service';
import {
  MarketplaceConsolidatedRequestAcceptDeclineService,
  MARKETPLACE_CONSOLIDATED_REQUEST_ACCEPT_DECLINE_SERVICE,
} from './services/marketplace-consolidated-request-accept-decline.service';
import {
  MarketplaceOrderSupplierActionService,
  MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
} from './services/marketplace-order-supplier-action.service';
import { MarketplaceOrderSyncService } from '../sync/marketplace-order-sync.service';
import {
  MarketplaceCycleAggregatorService,
  MARKETPLACE_CYCLE_AGGREGATOR_SERVICE,
} from './services/marketplace-cycle-aggregator.service';
import {
  MarketplaceShipmentCreateService,
  MARKETPLACE_SHIPMENT_CREATE_SERVICE,
} from './services/marketplace-shipment-create.service';
import { MarketplaceShipmentResolver } from './resolvers/marketplace-shipment.resolver';
import {
  MarketplaceInventoryLabelService,
  MARKETPLACE_INVENTORY_LABEL_SERVICE,
} from './services/marketplace-inventory-label.service';
import { MarketplaceInventoryResolver } from './resolvers/marketplace-inventory.resolver';
import {
  MarketplaceAplReceptionService,
  MARKETPLACE_APL_RECEPTION_SERVICE,
} from './services/marketplace-apl-reception.service';
import { MarketplaceAplReceptionResolver } from './resolvers/marketplace-apl-reception.resolver';
import {
  MarketplaceOutgoingPaymentService,
  MARKETPLACE_OUTGOING_PAYMENT_SERVICE,
} from './services/marketplace-outgoing-payment.service';
import { MarketplaceOutgoingPaymentResolver } from './resolvers/marketplace-outgoing-payment.resolver';

/**
 * Модуль приложения marketplace
 * Содержит GraphQL резолверы и сервисы приложения
 */
@Module({
  imports: [
    MarketplaceExtensionDomainModule,
    // Story 4.2: @Cron в MarketplaceCycleAggregatorService (time_based aggregator
    // каждые 5 минут + volume_based expire каждый час). ScheduleModule.forRoot()
    // идемпотентен — если AppModule тоже инициализирует его, NestJS использует
    // singleton SchedulerRegistry.
    ScheduleModule.forRoot(),
  ],
  providers: [
    // GraphQL резолверы
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
    RequestResolver,
    MarketplaceMembershipResolver,
    KuDetailsResolver,
    MarketplaceOnboardingResolver,
    MarketplaceMemberWalletResolver,
    MarketplaceCoopAcceptanceResolver,
    MarketplaceRegistrationOfferResolver,
    MarketplaceWhitelistResolver,
    MarketplaceVitrineResolver,
    MarketplaceOfferResolver,
    MarketplaceModerationResolver,
    MarketplaceCatalogResolver,
    MarketplaceOrderResolver,
    MarketplaceCycleResolver,
    MarketplaceShipmentResolver,
    MarketplaceInventoryResolver,
    MarketplaceAplReceptionResolver,
    MarketplaceOutgoingPaymentResolver,

    // Guards (Story 1.3 / Story 1.6)
    MarketplaceMembershipGuard,
    MarketplaceRoleGuard,

    // Сервисы приложения
    {
      provide: CATEGORY_TREE_SERVICE,
      useClass: CategoryTreeService,
    },
    CategoryTreeService,
    KuDetailsService,
    MarketplaceOnboardingService,
    MarketplaceCoopAcceptanceService,
    // Story 3.1
    {
      provide: MARKETPLACE_WHITELIST_SERVICE,
      useClass: MarketplaceWhitelistService,
    },
    MarketplaceWhitelistService,
    {
      provide: MARKETPLACE_VITRINE_SERVICE,
      useClass: MarketplaceVitrineService,
    },
    MarketplaceVitrineService,
    // Story 3.2
    {
      provide: MARKETPLACE_OFFER_SERVICE,
      useClass: MarketplaceOfferService,
    },
    MarketplaceOfferService,
    {
      provide: MARKETPLACE_CATEGORY_SERVICE,
      useClass: MarketplaceCategoryService,
    },
    MarketplaceCategoryService,
    // Story 3.3
    {
      provide: MARKETPLACE_MODERATION_SERVICE,
      useClass: MarketplaceModerationService,
    },
    MarketplaceModerationService,
    // Story 3.4
    {
      provide: MARKETPLACE_OFFER_COUNTERS_SERVICE,
      useClass: MarketplaceOfferCountersService,
    },
    MarketplaceOfferCountersService,
    marketplaceAssetConfigProvider,
    // Story 4.1
    {
      provide: MARKETPLACE_ORDER_CREATE_SERVICE,
      useClass: MarketplaceOrderCreateService,
    },
    MarketplaceOrderCreateService,
    MarketplaceOrderSyncService,
    // Story 4.4
    {
      provide: MARKETPLACE_ORDER_CANCEL_SERVICE,
      useClass: MarketplaceOrderCancelService,
    },
    MarketplaceOrderCancelService,
    // Story 4.5
    {
      provide: MARKETPLACE_CONSOLIDATED_REQUEST_ACCEPT_DECLINE_SERVICE,
      useClass: MarketplaceConsolidatedRequestAcceptDeclineService,
    },
    MarketplaceConsolidatedRequestAcceptDeclineService,
    {
      provide: MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
      useClass: MarketplaceOrderSupplierActionService,
    },
    MarketplaceOrderSupplierActionService,
    // Story 4.2
    {
      provide: MARKETPLACE_CYCLE_AGGREGATOR_SERVICE,
      useClass: MarketplaceCycleAggregatorService,
    },
    MarketplaceCycleAggregatorService,
    // Story 5.1 / 5.2 — формирование партий поставки + валидация состава
    {
      provide: MARKETPLACE_SHIPMENT_CREATE_SERVICE,
      useClass: MarketplaceShipmentCreateService,
    },
    MarketplaceShipmentCreateService,
    // Story 5.5 — маркировка имущества штрих-кодом
    {
      provide: MARKETPLACE_INVENTORY_LABEL_SERVICE,
      useClass: MarketplaceInventoryLabelService,
    },
    MarketplaceInventoryLabelService,
    // Story 5.3 / 5.4 — АПП приёмки на КУ
    {
      provide: MARKETPLACE_APL_RECEPTION_SERVICE,
      useClass: MarketplaceAplReceptionService,
    },
    MarketplaceAplReceptionService,
    // Story 5.6 / 5.7 — реестр исходящих платежей + подтверждение кассиром
    {
      provide: MARKETPLACE_OUTGOING_PAYMENT_SERVICE,
      useClass: MarketplaceOutgoingPaymentService,
    },
    MarketplaceOutgoingPaymentService,
  ],
  exports: [
    // Экспортируем сервисы для использования в других модулях
    CATEGORY_TREE_SERVICE,
    MarketplaceMembershipGuard,
    MarketplaceRoleGuard,
    KuDetailsService,
    MarketplaceOnboardingService,
    MarketplaceCoopAcceptanceService,
    MARKETPLACE_WHITELIST_SERVICE,
    MarketplaceWhitelistService,
    MARKETPLACE_VITRINE_SERVICE,
    MarketplaceVitrineService,
    MARKETPLACE_OFFER_SERVICE,
    MarketplaceOfferService,
    MARKETPLACE_CATEGORY_SERVICE,
    MarketplaceCategoryService,
    MARKETPLACE_MODERATION_SERVICE,
    MarketplaceModerationService,
    MARKETPLACE_OFFER_COUNTERS_SERVICE,
    MarketplaceOfferCountersService,

    // Экспортируем резолверы для регистрации в GraphQL
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
    RequestResolver,
    MarketplaceMembershipResolver,
    KuDetailsResolver,
    MarketplaceOnboardingResolver,
    MarketplaceMemberWalletResolver,
    MarketplaceCoopAcceptanceResolver,
    MarketplaceRegistrationOfferResolver,
    MarketplaceWhitelistResolver,
    MarketplaceVitrineResolver,
    MarketplaceOfferResolver,
    MarketplaceModerationResolver,
    MarketplaceCatalogResolver,
    MarketplaceOrderResolver,
    MarketplaceCycleResolver,
    MarketplaceShipmentResolver,
    MarketplaceInventoryResolver,
    MarketplaceAplReceptionResolver,
    MarketplaceOutgoingPaymentResolver,

    // Экспортируем сервисы Story 4.1 для использования в follow-up Stories Эпика 4
    MARKETPLACE_ORDER_CREATE_SERVICE,
    MarketplaceOrderCreateService,
    MarketplaceOrderSyncService,
    // Story 4.4
    MARKETPLACE_ORDER_CANCEL_SERVICE,
    MarketplaceOrderCancelService,
    // Story 4.5
    MARKETPLACE_CONSOLIDATED_REQUEST_ACCEPT_DECLINE_SERVICE,
    MarketplaceConsolidatedRequestAcceptDeclineService,
    MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
    MarketplaceOrderSupplierActionService,
    // Story 4.2
    MARKETPLACE_CYCLE_AGGREGATOR_SERVICE,
    MarketplaceCycleAggregatorService,
    // Story 5.1 / 5.2
    MARKETPLACE_SHIPMENT_CREATE_SERVICE,
    MarketplaceShipmentCreateService,
    // Story 5.5
    MARKETPLACE_INVENTORY_LABEL_SERVICE,
    MarketplaceInventoryLabelService,
    // Story 5.3 / 5.4
    MARKETPLACE_APL_RECEPTION_SERVICE,
    MarketplaceAplReceptionService,
    // Story 5.6 / 5.7
    MARKETPLACE_OUTGOING_PAYMENT_SERVICE,
    MarketplaceOutgoingPaymentService,
  ],
})
export class MarketplaceExtensionApplicationModule {}
