/**
 * Сущности расширения «Стол заказов»: явная декларация состава таблиц.
 *
 * Раньше TypeORM находил их файловым глобом по `src/extensions/**`. Глоб
 * привязывает расширение к его месту на диске: тот же код, установленный
 * пакетом в `node_modules`, под него не попадает — таблицы не создаются,
 * репозитории не поднимаются, расширение не стартует. Поэтому состав
 * объявляется здесь и попадает в подключение через запись реестра.
 */
import { AttributeEntity } from './infrastructure/entities/attribute.entity';
import { AvailableCategoryEntity } from './infrastructure/entities/available-category.entity';
import { CategoryTypeAttributeEntity } from './infrastructure/entities/category-type-attribute.entity';
import { CategoryEntity } from './infrastructure/entities/category.entity';
import { DictionaryValueEntity } from './infrastructure/entities/dictionary-value.entity';
import { DictionaryEntity } from './infrastructure/entities/dictionary.entity';
import { KuDetailsTypeormEntity } from './infrastructure/entities/ku-details.entity';
import { MarketplaceAplReceptionEntity } from './infrastructure/entities/marketplace-apl-reception.entity';
import { MarketplaceCartItemEntity } from './infrastructure/entities/marketplace-cart-item.entity';
import { MarketplaceCartEntity } from './infrastructure/entities/marketplace-cart.entity';
import { MarketplaceCategoryEntity } from './infrastructure/entities/marketplace-category.entity';
import { MarketplaceConsolidatedRequestEntity } from './infrastructure/entities/marketplace-consolidated-request.entity';
import { MarketplaceContainerTypeEntity, MarketplaceContainerEntity } from './infrastructure/entities/marketplace-container.entity';
import { MarketplaceInventoryEntity } from './infrastructure/entities/marketplace-inventory.entity';
import { MarketplaceIssuanceSagaEntity } from './infrastructure/entities/marketplace-issuance-saga.entity';
import { MarketplaceModerationLogEntity } from './infrastructure/entities/marketplace-moderation-log.entity';
import { MarketplaceOfferEntity } from './infrastructure/entities/marketplace-offer.entity';
import { MarketplaceOrderEntity } from './infrastructure/entities/marketplace-order.entity';
import { MarketplaceOutgoingPaymentRequestEntity } from './infrastructure/entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceReturnClaimEntity } from './infrastructure/entities/marketplace-return-claim.entity';
import { MarketplaceShipmentEntity } from './infrastructure/entities/marketplace-shipment.entity';
import { MarketplaceStockProposalEntity } from './infrastructure/entities/marketplace-stock-proposal.entity';
import { MarketplaceStorageCellEntity } from './infrastructure/entities/marketplace-storage-cell.entity';
import { MarketplaceSupplierSettingsEntity } from './infrastructure/entities/marketplace-supplier-settings.entity';
import { MarketplaceSupplierEntity } from './infrastructure/entities/marketplace-supplier.entity';
import { MarketplaceSupplyValidationLogEntity } from './infrastructure/entities/marketplace-supply-validation-log.entity';
import { MarketplaceTtnDocumentEntity } from './infrastructure/entities/marketplace-ttn-document.entity';
import { MarketplaceVitrineEntity } from './infrastructure/entities/marketplace-vitrine.entity';
import { MarketplaceWriteoffProposalEntity } from './infrastructure/entities/marketplace-writeoff-proposal.entity';
import { RequestAttributeValueEntity } from './infrastructure/entities/request-attribute-value.entity';
import { RequestImageEntity } from './infrastructure/entities/request-image.entity';
import { RequestEntity } from './infrastructure/entities/request.entity';
import { TypeEntity } from './infrastructure/entities/type.entity';

export const marketplaceEntities = [
  AttributeEntity,
  AvailableCategoryEntity,
  CategoryTypeAttributeEntity,
  CategoryEntity,
  DictionaryValueEntity,
  DictionaryEntity,
  KuDetailsTypeormEntity,
  MarketplaceAplReceptionEntity,
  MarketplaceCartItemEntity,
  MarketplaceCartEntity,
  MarketplaceCategoryEntity,
  MarketplaceConsolidatedRequestEntity,
  MarketplaceContainerTypeEntity,
  MarketplaceContainerEntity,
  MarketplaceInventoryEntity,
  MarketplaceIssuanceSagaEntity,
  MarketplaceModerationLogEntity,
  MarketplaceOfferEntity,
  MarketplaceOrderEntity,
  MarketplaceOutgoingPaymentRequestEntity,
  MarketplaceReturnClaimEntity,
  MarketplaceShipmentEntity,
  MarketplaceStockProposalEntity,
  MarketplaceStorageCellEntity,
  MarketplaceSupplierSettingsEntity,
  MarketplaceSupplierEntity,
  MarketplaceSupplyValidationLogEntity,
  MarketplaceTtnDocumentEntity,
  MarketplaceVitrineEntity,
  MarketplaceWriteoffProposalEntity,
  RequestAttributeValueEntity,
  RequestImageEntity,
  RequestEntity,
  TypeEntity,
];
