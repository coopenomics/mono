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

// Repository adapters
import { CategoryRepositoryAdapter } from './adapters/category-repository.adapter';
import { TypeRepositoryAdapter } from './adapters/type-repository.adapter';
import { AttributeRepositoryAdapter } from './adapters/attribute-repository.adapter';
import { DictionaryRepositoryAdapter } from './adapters/dictionary-repository.adapter';
import { DictionaryValueRepositoryAdapter } from './adapters/dictionary-value-repository.adapter';
import { AvailableCategoryRepositoryAdapter } from './adapters/available-category-repository.adapter';

// Repository tokens
import { CATEGORY_DOMAIN_REPOSITORY } from '../domain/repositories/category-domain.repository';
import { TYPE_DOMAIN_REPOSITORY } from '../domain/repositories/type-domain.repository';
import { ATTRIBUTE_DOMAIN_REPOSITORY } from '../domain/repositories/attribute-domain.repository';
import { DICTIONARY_DOMAIN_REPOSITORY } from '../domain/repositories/dictionary-domain.repository';
import { DICTIONARY_VALUE_DOMAIN_REPOSITORY } from '../domain/repositories/dictionary-value-domain.repository';
import { AVAILABLE_CATEGORY_DOMAIN_REPOSITORY } from '../domain/repositories/available-category-domain.repository';

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
      ],
      'marketplace'
    ), // Указываем имя подключения
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
  ],
  exports: [
    CATEGORY_DOMAIN_REPOSITORY,
    TYPE_DOMAIN_REPOSITORY,
    ATTRIBUTE_DOMAIN_REPOSITORY,
    DICTIONARY_DOMAIN_REPOSITORY,
    DICTIONARY_VALUE_DOMAIN_REPOSITORY,
    AVAILABLE_CATEGORY_DOMAIN_REPOSITORY,
  ],
})
export class MarketplaceInfrastructureModule {}
