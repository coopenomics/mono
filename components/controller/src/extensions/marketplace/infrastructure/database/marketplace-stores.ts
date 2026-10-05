import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { AvailableCategoryEntity } from '../entities/available-category.entity';
import { CategoryEntity } from '../entities/category.entity';
import { KuDetailsTypeormEntity } from '../entities/ku-details.entity';
import { MarketplaceAplReceptionEntity } from '../entities/marketplace-apl-reception.entity';
import { MarketplaceCartItemEntity } from '../entities/marketplace-cart-item.entity';
import { MarketplaceCartEntity } from '../entities/marketplace-cart.entity';
import { MarketplaceCategoryEntity } from '../entities/marketplace-category.entity';
import { MarketplaceConsolidatedRequestEntity } from '../entities/marketplace-consolidated-request.entity';
import { MarketplaceContainerTypeEntity, MarketplaceContainerEntity } from '../entities/marketplace-container.entity';
import { MarketplaceInventoryEntity } from '../entities/marketplace-inventory.entity';
import { MarketplaceIssuanceSagaEntity } from '../entities/marketplace-issuance-saga.entity';
import { MarketplaceModerationLogEntity } from '../entities/marketplace-moderation-log.entity';
import { MarketplaceOfferEntity } from '../entities/marketplace-offer.entity';
import { MarketplaceOrderEntity } from '../entities/marketplace-order.entity';
import { MarketplaceOutgoingPaymentRequestEntity } from '../entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceReturnClaimEntity } from '../entities/marketplace-return-claim.entity';
import { MarketplaceShipmentEntity } from '../entities/marketplace-shipment.entity';
import { MarketplaceStockProposalEntity } from '../entities/marketplace-stock-proposal.entity';
import { MarketplaceStorageCellEntity } from '../entities/marketplace-storage-cell.entity';
import { MarketplaceSupplierClaimEntity } from '../entities/marketplace-supplier-claim.entity';
import { MarketplaceSupplierSettingsEntity } from '../entities/marketplace-supplier-settings.entity';
import { MarketplaceSupplierEntity } from '../entities/marketplace-supplier.entity';
import { MarketplaceSupplyValidationLogEntity } from '../entities/marketplace-supply-validation-log.entity';
import { MarketplaceTtnDocumentEntity } from '../entities/marketplace-ttn-document.entity';
import { MarketplaceVitrineEntity } from '../entities/marketplace-vitrine.entity';
import { MarketplaceWriteoffProposalEntity } from '../entities/marketplace-writeoff-proposal.entity';
import { TypeEntity } from '../entities/type.entity';

/**
 * Шлюзы таблиц расширения: адаптеры хранилищ работают с записями целиком
 * (прочитал, поправил, сохранил), запросы к базе идут через Kysely.
 */
export const MARKETPLACE_AVAILABLE_CATEGORY_STORE = Symbol('Marketplace.MARKETPLACE_AVAILABLE_CATEGORY_STORE');
export const MARKETPLACE_CATALOG_CATEGORY_STORE = Symbol('Marketplace.MARKETPLACE_CATALOG_CATEGORY_STORE');
export const MARKETPLACE_KU_DETAILS_STORE = Symbol('Marketplace.MARKETPLACE_KU_DETAILS_STORE');
export const MARKETPLACE_APL_RECEPTION_STORE = Symbol('Marketplace.MARKETPLACE_APL_RECEPTION_STORE');
export const MARKETPLACE_CART_ITEM_STORE = Symbol('Marketplace.MARKETPLACE_CART_ITEM_STORE');
export const MARKETPLACE_CART_STORE = Symbol('Marketplace.MARKETPLACE_CART_STORE');
export const MARKETPLACE_CATEGORY_STORE = Symbol('Marketplace.MARKETPLACE_CATEGORY_STORE');
export const MARKETPLACE_CONSOLIDATED_REQUEST_STORE = Symbol('Marketplace.MARKETPLACE_CONSOLIDATED_REQUEST_STORE');
export const MARKETPLACE_CONTAINER_TYPE_STORE = Symbol('Marketplace.MARKETPLACE_CONTAINER_TYPE_STORE');
export const MARKETPLACE_CONTAINER_STORE = Symbol('Marketplace.MARKETPLACE_CONTAINER_STORE');
export const MARKETPLACE_INVENTORY_STORE = Symbol('Marketplace.MARKETPLACE_INVENTORY_STORE');
export const MARKETPLACE_ISSUANCE_SAGA_STORE = Symbol('Marketplace.MARKETPLACE_ISSUANCE_SAGA_STORE');
export const MARKETPLACE_MODERATION_LOG_STORE = Symbol('Marketplace.MARKETPLACE_MODERATION_LOG_STORE');
export const MARKETPLACE_OFFER_STORE = Symbol('Marketplace.MARKETPLACE_OFFER_STORE');
export const MARKETPLACE_ORDER_STORE = Symbol('Marketplace.MARKETPLACE_ORDER_STORE');
export const MARKETPLACE_OUTGOING_PAYMENT_REQUEST_STORE = Symbol('Marketplace.MARKETPLACE_OUTGOING_PAYMENT_REQUEST_STORE');
export const MARKETPLACE_RETURN_CLAIM_STORE = Symbol('Marketplace.MARKETPLACE_RETURN_CLAIM_STORE');
export const MARKETPLACE_SHIPMENT_STORE = Symbol('Marketplace.MARKETPLACE_SHIPMENT_STORE');
export const MARKETPLACE_STOCK_PROPOSAL_STORE = Symbol('Marketplace.MARKETPLACE_STOCK_PROPOSAL_STORE');
export const MARKETPLACE_STORAGE_CELL_STORE = Symbol('Marketplace.MARKETPLACE_STORAGE_CELL_STORE');
export const MARKETPLACE_SUPPLIER_CLAIM_STORE = Symbol('Marketplace.MARKETPLACE_SUPPLIER_CLAIM_STORE');
export const MARKETPLACE_SUPPLIER_SETTINGS_STORE = Symbol('Marketplace.MARKETPLACE_SUPPLIER_SETTINGS_STORE');
export const MARKETPLACE_SUPPLIER_STORE = Symbol('Marketplace.MARKETPLACE_SUPPLIER_STORE');
export const MARKETPLACE_SUPPLY_VALIDATION_LOG_STORE = Symbol('Marketplace.MARKETPLACE_SUPPLY_VALIDATION_LOG_STORE');
export const MARKETPLACE_TTN_DOCUMENT_STORE = Symbol('Marketplace.MARKETPLACE_TTN_DOCUMENT_STORE');
export const MARKETPLACE_VITRINE_STORE = Symbol('Marketplace.MARKETPLACE_VITRINE_STORE');
export const MARKETPLACE_WRITEOFF_PROPOSAL_STORE = Symbol('Marketplace.MARKETPLACE_WRITEOFF_PROPOSAL_STORE');
export const MARKETPLACE_CATALOG_TYPE_STORE = Symbol('Marketplace.MARKETPLACE_CATALOG_TYPE_STORE');

export const marketplaceStoreProviders: Provider[] = [
  {
    provide: MARKETPLACE_AVAILABLE_CATEGORY_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<AvailableCategoryEntity>(db, {
        table: 'available_categories',
        primaryKey: ['id'],
        updatedAt: 'updatedAt',
      }),
  },
  {
    provide: MARKETPLACE_CATALOG_CATEGORY_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<CategoryEntity>(db, {
        table: 'categories',
        primaryKey: ['descriptionCategoryId'],
        updatedAt: 'updatedAt',
      }),
  },
  {
    provide: MARKETPLACE_KU_DETAILS_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<KuDetailsTypeormEntity>(db, {
        table: 'marketplace_ku_details',
        primaryKey: ['id'],
        json: ['workingHoursJson'],
        updatedAt: 'updatedAt',
      }),
  },
  {
    provide: MARKETPLACE_APL_RECEPTION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceAplReceptionEntity>(db, {
        table: 'marketplace_apl_reception',
        primaryKey: ['id'],
        json: ['fact_quantity_per_order', 'expeditor_data', 'supplier_signed_documents'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_CART_ITEM_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceCartItemEntity>(db, {
        table: 'marketplace_cart_item',
        primaryKey: ['id'],
        numbers: ['quantity'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_CART_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceCartEntity>(db, {
        table: 'marketplace_cart',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_CATEGORY_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceCategoryEntity>(db, {
        table: 'marketplace_category',
        primaryKey: ['id'],
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_CONSOLIDATED_REQUEST_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceConsolidatedRequestEntity>(db, {
        table: 'marketplace_consolidated_request',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_CONTAINER_TYPE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceContainerTypeEntity>(db, {
        table: 'marketplace_container_type',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_CONTAINER_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceContainerEntity>(db, {
        table: 'marketplace_container',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_INVENTORY_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceInventoryEntity>(db, {
        table: 'marketplace_inventory',
        primaryKey: ['id'],
        numbers: ['package_size'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_ISSUANCE_SAGA_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceIssuanceSagaEntity>(db, {
        table: 'marketplace_issuance_saga',
        primaryKey: ['id'],
        json: ['fact', 'statement_document', 'protocol_document', 'act1_document', 'act2_document', 'tx_hashes'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_MODERATION_LOG_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceModerationLogEntity>(db, {
        table: 'marketplace_moderation_log',
        primaryKey: ['id'],
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_OFFER_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceOfferEntity>(db, {
        table: 'marketplace_offer',
        primaryKey: ['id'],
        json: ['packages', 'delivery_points', 'images'],
        numbers: ['quantity_available', 'quantity_blocked', 'quantity_consumed'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_ORDER_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceOrderEntity>(db, {
        table: 'marketplace_order',
        primaryKey: ['id'],
        json: ['create_tx', 'issuance_fact'],
        numbers: ['package_size', 'quantity'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_OUTGOING_PAYMENT_REQUEST_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceOutgoingPaymentRequestEntity>(db, {
        table: 'marketplace_outgoing_payment_request',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_RETURN_CLAIM_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceReturnClaimEntity>(db, {
        table: 'marketplace_return_claim',
        primaryKey: ['id'],
        json: ['photos', 'statement', 'cancel_statement', 'council_protocol', 'decision_log', 'on_site_inspection', 'ledger_snapshot'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_SHIPMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceShipmentEntity>(db, {
        table: 'marketplace_shipment',
        primaryKey: ['id'],
        json: ['ttn_data'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_STOCK_PROPOSAL_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceStockProposalEntity>(db, {
        table: 'marketplace_stock_proposal',
        primaryKey: ['id'],
        json: ['items', 'created_order_ids'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_STORAGE_CELL_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceStorageCellEntity>(db, {
        table: 'marketplace_storage_cell',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_SUPPLIER_CLAIM_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceSupplierClaimEntity>(db, {
        table: 'marketplace_supplier_claim',
        primaryKey: ['id'],
        json: ['photos', 'reclamation'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_SUPPLIER_SETTINGS_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceSupplierSettingsEntity>(db, {
        table: 'marketplace_supplier_settings',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_SUPPLIER_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceSupplierEntity>(db, {
        table: 'marketplace_supplier',
        primaryKey: ['id'],
        dates: ['contract_date'],
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_SUPPLY_VALIDATION_LOG_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceSupplyValidationLogEntity>(db, {
        table: 'marketplace_supply_validation_log',
        primaryKey: ['id'],
        json: ['attempted_groups'],
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_TTN_DOCUMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceTtnDocumentEntity>(db, {
        table: 'marketplace_ttn_document',
        primaryKey: ['id'],
        json: ['meta', 'ttn_data'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_VITRINE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceVitrineEntity>(db, {
        table: 'marketplace_vitrine',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_WRITEOFF_PROPOSAL_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MarketplaceWriteoffProposalEntity>(db, {
        table: 'marketplace_writeoff_proposal',
        primaryKey: ['id'],
        json: ['items', 'protocol_doc', 'statement_doc', 'decision_log'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: MARKETPLACE_CATALOG_TYPE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<TypeEntity>(db, {
        table: 'types',
        primaryKey: ['typeId'],
        updatedAt: 'updatedAt',
      }),
  },
];
