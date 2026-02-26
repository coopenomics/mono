import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCardResolver } from './application/resolvers/product-card.resolver';
import { CategoryResolver } from './application/resolvers/category.resolver';
import { ProductCardService } from './domain/services/product-card.service';
import { PRODUCT_CARD_REPOSITORY } from './domain/repositories/product-card.repository';
import { CATEGORY_REPOSITORY } from './domain/repositories/category.repository';
import { SUPPLY_ORDER_REPOSITORY } from './domain/repositories/supply-order.repository';
import { ProductCardTypeormEntity } from './infrastructure/entities/product-card.typeorm-entity';
import { CategoryTypeormEntity } from './infrastructure/entities/category.typeorm-entity';
import { SupplyOrderTypeormEntity } from './infrastructure/entities/supply-order.typeorm-entity';
import { ProductCardTypeormRepository } from './infrastructure/repositories/product-card.typeorm-repository';
import { CategoryTypeormRepository } from './infrastructure/repositories/category.typeorm-repository';
import { SupplyOrderTypeormRepository } from './infrastructure/repositories/supply-order.typeorm-repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductCardTypeormEntity,
      CategoryTypeormEntity,
      SupplyOrderTypeormEntity,
    ]),
  ],
  providers: [
    ProductCardResolver,
    CategoryResolver,
    ProductCardService,
    { provide: PRODUCT_CARD_REPOSITORY, useClass: ProductCardTypeormRepository },
    { provide: CATEGORY_REPOSITORY, useClass: CategoryTypeormRepository },
    { provide: SUPPLY_ORDER_REPOSITORY, useClass: SupplyOrderTypeormRepository },
  ],
  exports: [ProductCardService],
})
export class CooplaceExtensionModule {}
