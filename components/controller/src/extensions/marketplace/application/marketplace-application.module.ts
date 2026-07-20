import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketplaceExtensionDomainModule } from '../domain/marketplace-domain.module';
import { MarketplaceInfrastructureModule } from '../infrastructure/marketplace-infrastructure.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { UserModule } from '~/application/user/user.module';
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
import {
  MarketplaceOfferFieldsResolver,
  MarketplaceOfferDeliveryPointFieldsResolver,
} from './resolvers/marketplace-offer-fields.resolver';
import { MarketplaceKUDetailsFieldsResolver } from './resolvers/ku-details-fields.resolver';
import { MarketplaceOfferImagesService } from './services/marketplace-offer-images.service';
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
  MarketplaceKuChairmanService,
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
} from './services/marketplace-ku-chairman.service';
import {
  MarketplaceBranchOwnershipService,
  MARKETPLACE_BRANCH_OWNERSHIP_SERVICE,
} from './services/marketplace-branch-ownership.service';
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
import {
  MarketplaceOrderDisplayService,
  MARKETPLACE_ORDER_DISPLAY_SERVICE,
} from './services/marketplace-order-display.service';
import { marketplaceAssetConfigProvider } from './services/marketplace-asset.config.provider';
import {
  MarketplaceOrderCancelService,
  MARKETPLACE_ORDER_CANCEL_SERVICE,
} from './services/marketplace-order-cancel.service';
import {
  MarketplaceOrderSupplierActionService,
  MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
} from './services/marketplace-order-supplier-action.service';
import { MarketplaceOrderSyncService } from '../sync/marketplace-order-sync.service';
import { MarketplaceDesktopGrantsProvider } from './desktop/marketplace-desktop-grants.provider';
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
import { MarketplaceStockResolver } from './resolvers/marketplace-stock.resolver';
import {
  MarketplaceStockService,
  MARKETPLACE_STOCK_SERVICE,
} from './services/marketplace-stock.service';
import {
  MarketplaceStockProposalService,
  MARKETPLACE_STOCK_PROPOSAL_SERVICE,
} from './services/marketplace-stock-proposal.service';
import {
  MarketplaceAplReceptionService,
  MARKETPLACE_APL_RECEPTION_SERVICE,
} from './services/marketplace-apl-reception.service';
import { MarketplaceAplReceptionResolver } from './resolvers/marketplace-apl-reception.resolver';
import {
  MarketplacePayoutSyncService,
  MARKETPLACE_PAYOUT_SYNC_SERVICE,
} from './services/marketplace-payout-sync.service';
import { MarketplaceOutgoingPaymentResolver } from './resolvers/marketplace-outgoing-payment.resolver';
import { MarketplaceNotificationService } from './services/marketplace-notification.service';
import {
  MarketplaceIssuanceService,
  MARKETPLACE_ISSUANCE_SERVICE,
} from './services/marketplace-issuance.service';
import { MarketplaceIssuanceResolver } from './resolvers/marketplace-issuance.resolver';
// Эпик 7 — гарантийный возврат (compensating forward)
import {
  MarketplaceReturnClaimService,
  MARKETPLACE_RETURN_CLAIM_SERVICE,
} from './services/marketplace-return-claim.service';
import { MarketplaceReturnClaimImagesService } from './services/marketplace-return-claim-images.service';
import { MarketplaceReturnClaimResolver } from './resolvers/marketplace-return-claim.resolver';
import { FileStorageInfrastructureModule } from '~/infrastructure/file-storage';
// Эпик 8 — списание скоропорта через решение совета
import { MarketplaceWriteoffService } from './services/marketplace-writeoff.service';
import { MarketplaceWriteoffCronService } from './services/marketplace-writeoff-cron.service';
import { MarketplaceWriteoffResolver } from './resolvers/marketplace-writeoff.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceInventoryEntity } from '../infrastructure/entities/marketplace-inventory.entity';
// Эпик 16 — корзина и заказ-агрегат
import { MarketplaceCartResolver } from './resolvers/marketplace-cart.resolver';
import {
  MarketplaceCartService,
  MARKETPLACE_CART_SERVICE,
} from './services/marketplace-cart.service';
import {
  MarketplaceCheckoutService,
  MARKETPLACE_CHECKOUT_SERVICE,
} from './services/marketplace-checkout.service';
// Фаза 2: realtime-подписка marketplace (GraphQL subscription поверх graphql-ws).
import { PubSubModule } from '~/infrastructure/pubsub/pubsub.module';
import { MarketplaceEventsResolver } from './resolvers/marketplace-events.resolver';
import { MarketplaceRealtimeBridge } from './realtime/marketplace-realtime.bridge';

/**
 * Модуль приложения marketplace
 * Содержит GraphQL резолверы и сервисы приложения
 */
@Module({
  imports: [
    MarketplaceExtensionDomainModule,
    // Резолверы (Story 3.x/4.x/5.x/...) инжектят MARKETPLACE_*_REPOSITORY и
    // MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT — прямой импорт инфраструктуры
    // (а не транзит через ExtensionsModule, который ломается forwardRef'ом
    // на ExtensionDomainModule ниже).
    MarketplaceInfrastructureModule,
    // ACCOUNT_DATA_PORT для MarketplaceNotificationService (Эпик 5+ push-уведомления).
    AccountInfrastructureModule,
    // ScheduleModule для @Cron marketplace-сервисов. forRoot() идемпотентен —
    // если AppModule тоже инициализирует его, NestJS использует singleton
    // SchedulerRegistry.
    ScheduleModule.forRoot(),
    // Story 598-17 / AR35: marketplace AplReception/OutgoingPayment сервисам
    // нужен GATEWAY_INTERACTOR_PORT для синхронизации с core-реестром
    // исходящих платежей. Модуль уже экспортирует токен — просто импорт.
    GatewayInfrastructureModule,
    // DocumentDomainService для генерации preview-документов АПП приёмки
    // через GENERATOR_PORT (registry_id=1102).
    DocumentDomainModule,
    // UserCertificateInteractor — резолв ФИО/наименования участников по аккаунту
    // для экранов приёмки/выдачи (MarketplaceOrderDisplayService).
    UserModule,
    // Эпик 7 / Story 7.1: bucket для фотографий гарантийного возврата
    // (`stol-zakazov:images`). Имя bucket'а декларируется через @UseBucket
    // на MarketplaceReturnClaimImagesService — модуль `forFeature` читает
    // метадату и провайдит ему `InterFileStorageBucket`.
    FileStorageInfrastructureModule.forFeature([
      MarketplaceReturnClaimImagesService,
      // Story 3.2 (доп.): bucket `stol-zakazov:images` для изображений Offer'а.
      MarketplaceOfferImagesService,
    ]),
    // Эпик 8: writeoff cron сканер должен видеть marketplace_inventory
    TypeOrmModule.forFeature([MarketplaceInventoryEntity], 'marketplace'),
    // Фаза 2: общий PubSub (@Global) для realtime-канала событий пайщика.
    PubSubModule,
    // ExtensionDomainService инжектится @Optional() в MarketplaceWriteoffCronService —
    // импортировать ExtensionDomainModule сюда нельзя (цикл AppModule → ExtensionDomainModule →
    // ExtensionsModule → MarketplacePluginModule → MarketplaceExtensionApplicationModule).
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
    MarketplaceStockResolver,
    MarketplaceAplReceptionResolver,
    MarketplaceOutgoingPaymentResolver,
    MarketplaceIssuanceResolver,
    MarketplaceReturnClaimResolver,
    // Эпик 16 — корзина заказчика
    MarketplaceCartResolver,
    // Фаза 2 — realtime-подписка персонального канала пайщика + мост из
    // доменных событий (EventEmitter2) в PubSub.
    MarketplaceEventsResolver,
    MarketplaceRealtimeBridge,

    // Guards (Story 1.3 / Story 1.6)
    MarketplaceMembershipGuard,
    MarketplaceRoleGuard,

    // Канон авторизации столов: провайдер грантов market для getDesktop
    // (само-регистрируется в глобальном ExtensionGrantsRegistry).
    MarketplaceDesktopGrantsProvider,

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
    // Эпик 2 / Story 2.x — источник isKuChairman (trustee ИЛИ trusted
    // одного из branches кооператива) для marketplace-роли `operator`.
    {
      provide: MARKETPLACE_KU_CHAIRMAN_SERVICE,
      useClass: MarketplaceKuChairmanService,
    },
    MarketplaceKuChairmanService,
    {
      provide: MARKETPLACE_BRANCH_OWNERSHIP_SERVICE,
      useClass: MarketplaceBranchOwnershipService,
    },
    MarketplaceBranchOwnershipService,
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
    // Story 3.2 (доп.): изображения Offer'а — bucket-сервис + field-resolver.
    MarketplaceOfferImagesService,
    MarketplaceOfferFieldsResolver,
    MarketplaceOfferDeliveryPointFieldsResolver,
    MarketplaceKUDetailsFieldsResolver,
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
    // Обогащение заказов отображаемыми реквизитами (товар/ПВЗ) для столов и лент выдачи
    {
      provide: MARKETPLACE_ORDER_DISPLAY_SERVICE,
      useClass: MarketplaceOrderDisplayService,
    },
    // Plain-class провайдер: field-резолверы оферты/КУ инжектят сервис по классу
    MarketplaceOrderDisplayService,
    // Story 4.4
    {
      provide: MARKETPLACE_ORDER_CANCEL_SERVICE,
      useClass: MarketplaceOrderCancelService,
    },
    MarketplaceOrderCancelService,
    // Эпик 15 — единый batch-accept/decline заказов поставщиком
    {
      provide: MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
      useClass: MarketplaceOrderSupplierActionService,
    },
    MarketplaceOrderSupplierActionService,
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
    // Story 5.6 / 5.7 + 598-16 (L12) — слушатель callback'ов от gateway
    // (payconfirm/paydecline) для зеркалирования статуса выплаты поставщику.
    // Сам кассир работает в общем столе кооператива через расширение
    // gateway, marketplace только подписывается на blockchain-action delta.
    {
      provide: MARKETPLACE_PAYOUT_SYNC_SERVICE,
      useClass: MarketplacePayoutSyncService,
    },
    MarketplacePayoutSyncService,
    // Story 598-20 — push-уведомления marketplace flow (АПП Б поставщику,
    // новая выплата кассиру, подтверждённая выплата поставщику).
    // Слушает per-contract event-bus, отправка через Novu без обратного
    // влияния на основной flow (INV-12: emit после save в PG).
    MarketplaceNotificationService,
    // Story 6.1 / 6.3 / 6.4 — выдача пайщику с двойной подписью АПП
    // (signiss1 + signiss2) и тремя ветками сверки факт vs заказ.
    {
      provide: MARKETPLACE_ISSUANCE_SERVICE,
      useClass: MarketplaceIssuanceService,
    },
    {
      provide: MARKETPLACE_STOCK_SERVICE,
      useClass: MarketplaceStockService,
    },
    MarketplaceStockService,
    {
      provide: MARKETPLACE_STOCK_PROPOSAL_SERVICE,
      useClass: MarketplaceStockProposalService,
    },
    MarketplaceStockProposalService,
    MarketplaceIssuanceService,
    // Эпик 7 — гарантийный возврат (compensating forward к o.mkt.consum).
    {
      provide: MARKETPLACE_RETURN_CLAIM_SERVICE,
      useClass: MarketplaceReturnClaimService,
    },
    MarketplaceReturnClaimService,
    MarketplaceReturnClaimImagesService,
    // Эпик 8 — списание скоропорта
    MarketplaceWriteoffService,
    MarketplaceWriteoffCronService,
    MarketplaceWriteoffResolver,
    // Эпик 16 — корзина заказчика
    {
      provide: MARKETPLACE_CART_SERVICE,
      useClass: MarketplaceCartService,
    },
    MarketplaceCartService,
    {
      provide: MARKETPLACE_CHECKOUT_SERVICE,
      useClass: MarketplaceCheckoutService,
    },
    MarketplaceCheckoutService,
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
    MARKETPLACE_KU_CHAIRMAN_SERVICE,
    MarketplaceKuChairmanService,
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
    MarketplaceIssuanceResolver,
    MarketplaceReturnClaimResolver,

    // Экспортируем сервисы Story 4.1 для использования в follow-up Stories Эпика 4
    MARKETPLACE_ORDER_CREATE_SERVICE,
    MarketplaceOrderCreateService,
    MarketplaceOrderSyncService,
    // Story 4.4
    MARKETPLACE_ORDER_CANCEL_SERVICE,
    MarketplaceOrderCancelService,
    // Эпик 15 — единый batch-accept/decline
    MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
    MarketplaceOrderSupplierActionService,
    // Story 5.1 / 5.2
    MARKETPLACE_SHIPMENT_CREATE_SERVICE,
    MarketplaceShipmentCreateService,
    // Story 5.5
    MARKETPLACE_INVENTORY_LABEL_SERVICE,
    MarketplaceInventoryLabelService,
    // Story 5.3 / 5.4
    MARKETPLACE_APL_RECEPTION_SERVICE,
    MarketplaceAplReceptionService,
    // Story 5.6 / 5.7 + 598-16
    MARKETPLACE_PAYOUT_SYNC_SERVICE,
    MarketplacePayoutSyncService,
    // Story 6.1 / 6.3 / 6.4
    MARKETPLACE_ISSUANCE_SERVICE,
    MarketplaceIssuanceService,
    MARKETPLACE_STOCK_SERVICE,
    MarketplaceStockService,
    MARKETPLACE_STOCK_PROPOSAL_SERVICE,
    MarketplaceStockProposalService,
    // Эпик 7
    MARKETPLACE_RETURN_CLAIM_SERVICE,
    MarketplaceReturnClaimService,
    // Эпик 8
    MarketplaceWriteoffService,
    MarketplaceWriteoffResolver,
    // Эпик 16 — корзина заказчика
    MARKETPLACE_CART_SERVICE,
    MarketplaceCartService,
    MARKETPLACE_CHECKOUT_SERVICE,
    MarketplaceCheckoutService,
    MarketplaceCartResolver,
  ],
})
export class MarketplaceExtensionApplicationModule {}
