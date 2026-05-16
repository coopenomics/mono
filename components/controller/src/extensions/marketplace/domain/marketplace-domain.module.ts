import { Module } from '@nestjs/common';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from './services/category-tree-domain.service';
import { AttributeDomainService } from './services/attribute-domain.service';
import {
  AvailableCategoryDomainService,
  AVAILABLE_CATEGORY_DOMAIN_SERVICE,
} from './services/available-category-domain.service';
import { RequestDomainService, REQUEST_DOMAIN_SERVICE } from './services/request-domain.service';
import {
  MarketplaceAplReceptionDocumentFactory,
  MARKETPLACE_APL_RECEPTION_DOCUMENT_FACTORY,
} from './services/marketplace-apl-reception-document-factory';
import { MarketplaceInfrastructureModule } from '../infrastructure/marketplace-infrastructure.module';

/**
 * Доменный модуль marketplace
 * Содержит бизнес-логику и правила для работы с категориями, типами товаров и атрибутами
 *
 * Принцип инверсии зависимостей (DIP):
 * - Домен определяет интерфейсы репозиториев (абстракции)
 * - Инфраструктура реализует эти интерфейсы (детали)
 * - Импорт инфраструктуры нужен только для DI контейнера NestJS
 */
@Module({
  imports: [
    MarketplaceInfrastructureModule, // Предоставляет реализации доменных интерфейсов
  ],
  providers: [
    {
      provide: CATEGORY_TREE_DOMAIN_SERVICE,
      useClass: CategoryTreeDomainService,
    },
    CategoryTreeDomainService,
    AttributeDomainService,
    {
      provide: AVAILABLE_CATEGORY_DOMAIN_SERVICE,
      useClass: AvailableCategoryDomainService,
    },
    AvailableCategoryDomainService,
    {
      provide: REQUEST_DOMAIN_SERVICE,
      useClass: RequestDomainService,
    },
    RequestDomainService,
    {
      provide: MARKETPLACE_APL_RECEPTION_DOCUMENT_FACTORY,
      useClass: MarketplaceAplReceptionDocumentFactory,
    },
    MarketplaceAplReceptionDocumentFactory,
  ],
  exports: [
    CategoryTreeDomainService,
    AttributeDomainService,
    CATEGORY_TREE_DOMAIN_SERVICE,
    AvailableCategoryDomainService,
    AVAILABLE_CATEGORY_DOMAIN_SERVICE,
    RequestDomainService,
    REQUEST_DOMAIN_SERVICE,
    MarketplaceAplReceptionDocumentFactory,
    MARKETPLACE_APL_RECEPTION_DOCUMENT_FACTORY,
  ],
})
export class MarketplaceExtensionDomainModule {}
