import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from '~/config/config';

// TypeORM entities
import { CategoryEntity } from './entities/category.entity';
import { TypeEntity } from './entities/type.entity';
import { AttributeEntity } from './entities/attribute.entity';
import { DictionaryEntity } from './entities/dictionary.entity';
import { DictionaryValueEntity } from './entities/dictionary-value.entity';
import { CategoryTypeAttributeEntity } from './entities/category-type-attribute.entity';
import { AvailableCategoryEntity } from './entities/available-category.entity';
import { RequestEntity } from './entities/request.entity';
import { RequestAttributeValueEntity } from './entities/request-attribute-value.entity';
import { RequestImageEntity } from './entities/request-image.entity';
import { KuDetailsTypeormEntity } from './entities/ku-details.entity';
import { MarketplaceVitrineEntity } from './entities/marketplace-vitrine.entity';
import { MarketplaceSupplierEntity } from './entities/marketplace-supplier.entity';
import { MarketplaceCategoryEntity } from './entities/marketplace-category.entity';
import { MarketplaceOfferEntity } from './entities/marketplace-offer.entity';
import { MarketplaceModerationLogEntity } from './entities/marketplace-moderation-log.entity';
import { MarketplaceOrderEntity } from './entities/marketplace-order.entity';
import { MarketplaceConsolidatedRequestEntity } from './entities/marketplace-consolidated-request.entity';
import { MarketplaceShipmentEntity } from './entities/marketplace-shipment.entity';
import { MarketplaceSupplyValidationLogEntity } from './entities/marketplace-supply-validation-log.entity';
import { MarketplaceInventoryEntity } from './entities/marketplace-inventory.entity';
import { MarketplaceStorageCellEntity } from './entities/marketplace-storage-cell.entity';
import { MarketplaceStockProposalEntity } from './entities/marketplace-stock-proposal.entity';
import { MarketplaceAplReceptionEntity } from './entities/marketplace-apl-reception.entity';
import { MarketplaceOutgoingPaymentRequestEntity } from './entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceTtnDocumentEntity } from './entities/marketplace-ttn-document.entity';
import { MarketplaceReturnClaimEntity } from './entities/marketplace-return-claim.entity';
import { MarketplaceWriteoffProposalEntity } from './entities/marketplace-writeoff-proposal.entity';
import { MarketplaceCartEntity } from './entities/marketplace-cart.entity';
import { MarketplaceCartItemEntity } from './entities/marketplace-cart-item.entity';
import { MarketplaceSupplierSettingsEntity } from './entities/marketplace-supplier-settings.entity';

// Repository adapters
import { CategoryRepositoryAdapter } from './adapters/category-repository.adapter';
import { TypeRepositoryAdapter } from './adapters/type-repository.adapter';
import { AttributeRepositoryAdapter } from './adapters/attribute-repository.adapter';
import { DictionaryRepositoryAdapter } from './adapters/dictionary-repository.adapter';
import { DictionaryValueRepositoryAdapter } from './adapters/dictionary-value-repository.adapter';
import { AvailableCategoryRepositoryAdapter } from './adapters/available-category-repository.adapter';
import { RequestRepositoryAdapter } from './adapters/request-repository.adapter';
import { KuDetailsRepositoryAdapter } from './adapters/ku-details-repository.adapter';
import { geocoderPortFactory } from './adapters/geocoder.factory';
import { MarketplaceVitrineRepositoryAdapter } from './adapters/marketplace-vitrine-repository.adapter';
import { MarketplaceSupplierRepositoryAdapter } from './adapters/marketplace-supplier-repository.adapter';
import { MarketplaceCategoryRepositoryAdapter } from './adapters/marketplace-category-repository.adapter';
import { MarketplaceOfferRepositoryAdapter } from './adapters/marketplace-offer-repository.adapter';
import { MarketplaceModerationLogRepositoryAdapter } from './adapters/marketplace-moderation-log-repository.adapter';
import { MarketplaceOrderRepositoryAdapter } from './adapters/marketplace-order-repository.adapter';
import { MarketplaceCanonicalBlockchainAdapter } from './adapters/marketplace-canonical-blockchain.adapter';
import { MarketplaceConsolidatedRequestRepositoryAdapter } from './adapters/marketplace-consolidated-request-repository.adapter';
import { MarketplaceShipmentRepositoryAdapter } from './adapters/marketplace-shipment-repository.adapter';
import { MarketplaceSupplyValidationLogRepositoryAdapter } from './adapters/marketplace-supply-validation-log-repository.adapter';
import { MarketplaceInventoryRepositoryAdapter } from './adapters/marketplace-inventory-repository.adapter';
import { MarketplaceStorageCellRepositoryAdapter } from './adapters/marketplace-storage-cell-repository.adapter';
import { MarketplaceStockProposalRepositoryAdapter } from './adapters/marketplace-stock-proposal-repository.adapter';
import { MarketplaceAplReceptionRepositoryAdapter } from './adapters/marketplace-apl-reception-repository.adapter';
import { MarketplaceOutgoingPaymentRequestRepositoryAdapter } from './adapters/marketplace-outgoing-payment-request-repository.adapter';
import { MarketplaceTtnDocumentRepositoryAdapter } from './adapters/marketplace-ttn-document-repository.adapter';
import { MarketplaceReturnClaimRepositoryAdapter } from './adapters/marketplace-return-claim-repository.adapter';
import { MarketplaceWriteoffProposalRepositoryAdapter } from './adapters/marketplace-writeoff-proposal-repository.adapter';
import { MarketplaceCartRepositoryAdapter } from './adapters/marketplace-cart-repository.adapter';
import { MarketplaceSupplierSettingsRepositoryAdapter } from './adapters/marketplace-supplier-settings-repository.adapter';

// Mappers
import { MarketplaceVitrineMapper } from './mappers/marketplace-vitrine.mapper';
import { MarketplaceSupplierMapper } from './mappers/marketplace-supplier.mapper';
import { MarketplaceCategoryMapper } from './mappers/marketplace-category.mapper';
import { MarketplaceOfferMapper } from './mappers/marketplace-offer.mapper';
import { MarketplaceModerationLogMapper } from './mappers/marketplace-moderation-log.mapper';
import { MarketplaceOrderMapper } from './mappers/marketplace-order.mapper';
import { MarketplaceOrderDeltaMapper } from './mappers/marketplace-order-delta.mapper';
import { MarketplaceConsolidatedRequestMapper } from './mappers/marketplace-consolidated-request.mapper';
import { MarketplaceShipmentMapper } from './mappers/marketplace-shipment.mapper';
import { MarketplaceSupplyValidationLogMapper } from './mappers/marketplace-supply-validation-log.mapper';
import { MarketplaceInventoryMapper } from './mappers/marketplace-inventory.mapper';
import { MarketplaceStorageCellMapper } from './mappers/marketplace-storage-cell.mapper';
import { MarketplaceStockProposalMapper } from './mappers/marketplace-stock-proposal.mapper';
import { MarketplaceAplReceptionMapper } from './mappers/marketplace-apl-reception.mapper';
import { MarketplaceAplReceptionIndexInitializer } from './services/marketplace-apl-reception-index-initializer.service';
import { MarketplaceOutgoingPaymentRequestMapper } from './mappers/marketplace-outgoing-payment-request.mapper';
import { MarketplaceTtnDocumentMapper } from './mappers/marketplace-ttn-document.mapper';
import { MarketplaceReturnClaimMapper } from './mappers/marketplace-return-claim.mapper';
import { MarketplaceWriteoffProposalMapper } from './mappers/marketplace-writeoff-proposal.mapper';
import { MarketplaceCartMapper } from './mappers/marketplace-cart.mapper';

// Repository tokens
import { CATEGORY_DOMAIN_REPOSITORY } from '../domain/repositories/category-domain.repository';
import { TYPE_DOMAIN_REPOSITORY } from '../domain/repositories/type-domain.repository';
import { ATTRIBUTE_DOMAIN_REPOSITORY } from '../domain/repositories/attribute-domain.repository';
import { DICTIONARY_DOMAIN_REPOSITORY } from '../domain/repositories/dictionary-domain.repository';
import { DICTIONARY_VALUE_DOMAIN_REPOSITORY } from '../domain/repositories/dictionary-value-domain.repository';
import { AVAILABLE_CATEGORY_DOMAIN_REPOSITORY } from '../domain/repositories/available-category-domain.repository';
import { REQUEST_DOMAIN_REPOSITORY } from '../domain/repositories/request-domain.repository';
import { KU_DETAILS_DOMAIN_REPOSITORY } from '../domain/repositories/ku-details-domain.repository';
import { GEOCODER_PORT } from '../domain/ports/geocoder.port';
import { MARKETPLACE_VITRINE_REPOSITORY } from '../domain/repositories/marketplace-vitrine.repository';
import { MARKETPLACE_SUPPLIER_REPOSITORY } from '../domain/repositories/marketplace-supplier.repository';
import { MARKETPLACE_CATEGORY_REPOSITORY } from '../domain/repositories/marketplace-category.repository';
import { MARKETPLACE_OFFER_REPOSITORY } from '../domain/repositories/marketplace-offer.repository';
import { MARKETPLACE_MODERATION_LOG_REPOSITORY } from '../domain/repositories/marketplace-moderation-log.repository';
import { MARKETPLACE_ORDER_REPOSITORY } from '../domain/repositories/marketplace-order.repository';
import { MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT } from '../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY } from '../domain/repositories/marketplace-consolidated-request.repository';
import { MARKETPLACE_SHIPMENT_REPOSITORY } from '../domain/repositories/marketplace-shipment.repository';
import { MARKETPLACE_SUPPLY_VALIDATION_LOG_REPOSITORY } from '../domain/repositories/marketplace-supply-validation-log.repository';
import { MARKETPLACE_INVENTORY_REPOSITORY } from '../domain/repositories/marketplace-inventory.repository';
import { MARKETPLACE_STORAGE_CELL_REPOSITORY } from '../domain/repositories/marketplace-storage-cell.repository';
import { MARKETPLACE_STOCK_PROPOSAL_REPOSITORY } from '../domain/repositories/marketplace-stock-proposal.repository';
import { MARKETPLACE_APL_RECEPTION_REPOSITORY } from '../domain/repositories/marketplace-apl-reception.repository';
import { MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY } from '../domain/repositories/marketplace-outgoing-payment-request.repository';
import { MARKETPLACE_TTN_DOCUMENT_REPOSITORY } from '../domain/repositories/marketplace-ttn-document.repository';
import { MARKETPLACE_RETURN_CLAIM_REPOSITORY } from '../domain/repositories/marketplace-return-claim.repository';
import { MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY } from '../domain/repositories/marketplace-writeoff-proposal.repository';
import { MARKETPLACE_CART_REPOSITORY } from '../domain/repositories/marketplace-cart.repository';
import { MARKETPLACE_SUPPLIER_SETTINGS_REPOSITORY } from '../domain/repositories/marketplace-supplier-settings.repository';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';

@Module({
  imports: [
    // Создаем отдельное подключение для marketplace
    TypeOrmModule.forRoot({
      name: 'marketplace', // Имя подключения
      type: 'postgres',
      host: config.postgres.host,
      port: Number(config.postgres.port),
      username: config.postgres.username,
      password: config.postgres.password,
      database: config.postgres.database,
      entities: [
        CategoryEntity,
        TypeEntity,
        AttributeEntity,
        DictionaryEntity,
        DictionaryValueEntity,
        CategoryTypeAttributeEntity,
        AvailableCategoryEntity,
        RequestEntity,
        RequestAttributeValueEntity,
        RequestImageEntity,
        KuDetailsTypeormEntity,
        MarketplaceVitrineEntity,
        MarketplaceSupplierEntity,
        MarketplaceCategoryEntity,
        MarketplaceOfferEntity,
        MarketplaceModerationLogEntity,
        MarketplaceOrderEntity,
        MarketplaceConsolidatedRequestEntity,
        MarketplaceShipmentEntity,
        MarketplaceSupplyValidationLogEntity,
        MarketplaceInventoryEntity,
        MarketplaceStorageCellEntity,
        MarketplaceStockProposalEntity,
        MarketplaceAplReceptionEntity,
        MarketplaceOutgoingPaymentRequestEntity,
        MarketplaceTtnDocumentEntity,
        MarketplaceReturnClaimEntity,
        MarketplaceWriteoffProposalEntity,
        MarketplaceCartEntity,
        MarketplaceCartItemEntity,
        MarketplaceSupplierSettingsEntity,
      ],
      synchronize: true,
      logging: false,
    }),
    // Регистрируем entities для этого подключения
    TypeOrmModule.forFeature(
      [
        CategoryEntity,
        TypeEntity,
        AttributeEntity,
        DictionaryEntity,
        DictionaryValueEntity,
        CategoryTypeAttributeEntity,
        AvailableCategoryEntity,
        RequestEntity,
        RequestAttributeValueEntity,
        RequestImageEntity,
        KuDetailsTypeormEntity,
        MarketplaceVitrineEntity,
        MarketplaceSupplierEntity,
        MarketplaceCategoryEntity,
        MarketplaceOfferEntity,
        MarketplaceModerationLogEntity,
        MarketplaceOrderEntity,
        MarketplaceConsolidatedRequestEntity,
        MarketplaceShipmentEntity,
        MarketplaceSupplyValidationLogEntity,
        MarketplaceInventoryEntity,
        MarketplaceStorageCellEntity,
        MarketplaceStockProposalEntity,
        MarketplaceAplReceptionEntity,
        MarketplaceOutgoingPaymentRequestEntity,
        MarketplaceTtnDocumentEntity,
        MarketplaceReturnClaimEntity,
        MarketplaceWriteoffProposalEntity,
        MarketplaceCartEntity,
        MarketplaceCartItemEntity,
        MarketplaceSupplierSettingsEntity,
      ],
      'marketplace'
    ), // Указываем имя подключения
    // Поставляет VAULT_DOMAIN_SERVICE для MarketplaceCanonicalBlockchainAdapter
    // (WIF кооператива по data.coopname для подписи on-chain транзакций).
    VaultDomainModule,
  ],
  providers: [
    {
      provide: CATEGORY_DOMAIN_REPOSITORY,
      useClass: CategoryRepositoryAdapter,
    },
    {
      provide: TYPE_DOMAIN_REPOSITORY,
      useClass: TypeRepositoryAdapter,
    },
    {
      provide: ATTRIBUTE_DOMAIN_REPOSITORY,
      useClass: AttributeRepositoryAdapter,
    },
    {
      provide: DICTIONARY_DOMAIN_REPOSITORY,
      useClass: DictionaryRepositoryAdapter,
    },
    {
      provide: DICTIONARY_VALUE_DOMAIN_REPOSITORY,
      useClass: DictionaryValueRepositoryAdapter,
    },
    {
      provide: AVAILABLE_CATEGORY_DOMAIN_REPOSITORY,
      useClass: AvailableCategoryRepositoryAdapter,
    },
    {
      provide: REQUEST_DOMAIN_REPOSITORY,
      useClass: RequestRepositoryAdapter,
    },
    {
      provide: KU_DETAILS_DOMAIN_REPOSITORY,
      useClass: KuDetailsRepositoryAdapter,
    },
    {
      provide: GEOCODER_PORT,
      useFactory: geocoderPortFactory,
    },
    // Витрина + реестр поставщиков
    MarketplaceVitrineMapper,
    MarketplaceSupplierMapper,
    {
      provide: MARKETPLACE_VITRINE_REPOSITORY,
      useClass: MarketplaceVitrineRepositoryAdapter,
    },
    {
      provide: MARKETPLACE_SUPPLIER_REPOSITORY,
      useClass: MarketplaceSupplierRepositoryAdapter,
    },
    // Story 3.2
    MarketplaceCategoryMapper,
    MarketplaceOfferMapper,
    {
      provide: MARKETPLACE_CATEGORY_REPOSITORY,
      useClass: MarketplaceCategoryRepositoryAdapter,
    },
    {
      provide: MARKETPLACE_OFFER_REPOSITORY,
      useClass: MarketplaceOfferRepositoryAdapter,
    },
    // Story 3.3
    MarketplaceModerationLogMapper,
    {
      provide: MARKETPLACE_MODERATION_LOG_REPOSITORY,
      useClass: MarketplaceModerationLogRepositoryAdapter,
    },
    // Story 4.1
    MarketplaceOrderMapper,
    MarketplaceOrderDeltaMapper,
    {
      provide: MARKETPLACE_ORDER_REPOSITORY,
      useClass: MarketplaceOrderRepositoryAdapter,
    },
    {
      provide: MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
      useClass: MarketplaceCanonicalBlockchainAdapter,
    },
    // Story 4.2
    MarketplaceConsolidatedRequestMapper,
    {
      provide: MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
      useClass: MarketplaceConsolidatedRequestRepositoryAdapter,
    },
    // Story 5.1 / 5.2 — партия поставки + журнал валидаций
    MarketplaceShipmentMapper,
    MarketplaceSupplyValidationLogMapper,
    {
      provide: MARKETPLACE_SHIPMENT_REPOSITORY,
      useClass: MarketplaceShipmentRepositoryAdapter,
    },
    {
      provide: MARKETPLACE_SUPPLY_VALIDATION_LOG_REPOSITORY,
      useClass: MarketplaceSupplyValidationLogRepositoryAdapter,
    },
    // Story 5.5 — инвентарь КУ с маркировкой штрих-кодом
    MarketplaceInventoryMapper,
    MarketplaceStorageCellMapper,
    {
      provide: MARKETPLACE_INVENTORY_REPOSITORY,
      useClass: MarketplaceInventoryRepositoryAdapter,
    },
    {
      provide: MARKETPLACE_STORAGE_CELL_REPOSITORY,
      useClass: MarketplaceStorageCellRepositoryAdapter,
    },
    MarketplaceStockProposalMapper,
    {
      provide: MARKETPLACE_STOCK_PROPOSAL_REPOSITORY,
      useClass: MarketplaceStockProposalRepositoryAdapter,
    },
    // Story 5.3 / 5.4 — АПП приёмки на КУ
    MarketplaceAplReceptionMapper,
    MarketplaceAplReceptionIndexInitializer,
    {
      provide: MARKETPLACE_APL_RECEPTION_REPOSITORY,
      useClass: MarketplaceAplReceptionRepositoryAdapter,
    },
    // Story 5.6 / 5.7 — реестр исходящих платежей поставщикам
    MarketplaceOutgoingPaymentRequestMapper,
    {
      provide: MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
      useClass: MarketplaceOutgoingPaymentRequestRepositoryAdapter,
    },
    // Story 5.4 — локальный реестр ТТН (registry_id=1103, не on-chain)
    MarketplaceTtnDocumentMapper,
    {
      provide: MARKETPLACE_TTN_DOCUMENT_REPOSITORY,
      useClass: MarketplaceTtnDocumentRepositoryAdapter,
    },
    // Эпик 7 — заявления на гарантийный возврат имущества
    MarketplaceReturnClaimMapper,
    {
      provide: MARKETPLACE_RETURN_CLAIM_REPOSITORY,
      useClass: MarketplaceReturnClaimRepositoryAdapter,
    },
    // Эпик 8 — проекты решения совета о списании скоропорта
    MarketplaceWriteoffProposalMapper,
    {
      provide: MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY,
      useClass: MarketplaceWriteoffProposalRepositoryAdapter,
    },
    // Эпик 16 — корзина заказчика (off-chain CRUD)
    MarketplaceCartMapper,
    {
      provide: MARKETPLACE_CART_REPOSITORY,
      useClass: MarketplaceCartRepositoryAdapter,
    },
    // Настройки выплат поставщика — «выплаты получаю на…»
    {
      provide: MARKETPLACE_SUPPLIER_SETTINGS_REPOSITORY,
      useClass: MarketplaceSupplierSettingsRepositoryAdapter,
    },
  ],
  exports: [
    CATEGORY_DOMAIN_REPOSITORY,
    TYPE_DOMAIN_REPOSITORY,
    ATTRIBUTE_DOMAIN_REPOSITORY,
    DICTIONARY_DOMAIN_REPOSITORY,
    DICTIONARY_VALUE_DOMAIN_REPOSITORY,
    AVAILABLE_CATEGORY_DOMAIN_REPOSITORY,
    REQUEST_DOMAIN_REPOSITORY,
    KU_DETAILS_DOMAIN_REPOSITORY,
    GEOCODER_PORT,
    MARKETPLACE_VITRINE_REPOSITORY,
    MARKETPLACE_SUPPLIER_REPOSITORY,
    MARKETPLACE_CATEGORY_REPOSITORY,
    MARKETPLACE_OFFER_REPOSITORY,
    MARKETPLACE_MODERATION_LOG_REPOSITORY,
    MARKETPLACE_ORDER_REPOSITORY,
    MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
    MarketplaceOrderDeltaMapper,
    MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
    // Story 5.1 / 5.2
    MARKETPLACE_SHIPMENT_REPOSITORY,
    MARKETPLACE_SUPPLY_VALIDATION_LOG_REPOSITORY,
    // Story 5.5
    MARKETPLACE_INVENTORY_REPOSITORY,
    MARKETPLACE_STORAGE_CELL_REPOSITORY,
    MARKETPLACE_STOCK_PROPOSAL_REPOSITORY,
    // Story 5.3 / 5.4
    MARKETPLACE_APL_RECEPTION_REPOSITORY,
    // Story 5.6 / 5.7
    MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
    // Story 5.4 — локальный реестр ТТН
    MARKETPLACE_TTN_DOCUMENT_REPOSITORY,
    // Эпик 7 — гарантийный возврат
    MARKETPLACE_RETURN_CLAIM_REPOSITORY,
    // Эпик 8 — списание скоропорта
    MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY,
    // Эпик 16 — корзина заказчика
    MARKETPLACE_CART_REPOSITORY,
    // Настройки выплат поставщика
    MARKETPLACE_SUPPLIER_SETTINGS_REPOSITORY,
  ],
})
export class MarketplaceInfrastructureModule {}
