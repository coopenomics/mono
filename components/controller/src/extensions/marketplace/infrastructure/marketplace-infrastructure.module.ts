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

// Repository adapters
import { CategoryRepositoryAdapter } from './adapters/category-repository.adapter';
import { TypeRepositoryAdapter } from './adapters/type-repository.adapter';
import { AttributeRepositoryAdapter } from './adapters/attribute-repository.adapter';
import { DictionaryRepositoryAdapter } from './adapters/dictionary-repository.adapter';
import { DictionaryValueRepositoryAdapter } from './adapters/dictionary-value-repository.adapter';
import { AvailableCategoryRepositoryAdapter } from './adapters/available-category-repository.adapter';
import { RequestRepositoryAdapter } from './adapters/request-repository.adapter';
import { KuDetailsRepositoryAdapter } from './adapters/ku-details-repository.adapter';
import { YandexGeocoderAdapter } from './adapters/yandex-geocoder.adapter';

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
      useClass: YandexGeocoderAdapter,
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
  ],
})
export class MarketplaceInfrastructureModule {}
