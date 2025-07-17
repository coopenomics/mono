import { Module } from '@nestjs/common';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from './services/category-tree-domain.service';
import { AttributeDomainService } from './services/attribute-domain.service';
import {
  AvailableCategoryDomainService,
  AVAILABLE_CATEGORY_DOMAIN_SERVICE,
} from './services/available-category-domain.service';
import { MarketplaceInfrastructureModule } from '../infrastructure/marketplace-infrastructure.module';

/**
 * Доменный модуль marketplace
 * Содержит бизнес-логику и правила для работы с категориями, типами товаров и атрибутами
 */
@Module({
  imports: [
    MarketplaceInfrastructureModule, // Импортируем инфраструктурный модуль с репозиториями
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
  ],
  exports: [
    CategoryTreeDomainService,
    AttributeDomainService,
    CATEGORY_TREE_DOMAIN_SERVICE,
    AvailableCategoryDomainService,
    AVAILABLE_CATEGORY_DOMAIN_SERVICE,
  ],
})
export class MarketplaceDomainModule {}
