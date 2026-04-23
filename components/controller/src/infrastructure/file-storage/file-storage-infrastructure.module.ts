import { DynamicModule, Global, Module, type Type } from '@nestjs/common';
import { INTER_FILE_STORAGE, type InterFileStoragePort } from '@coopenomics/inter';
import { BucketRegistry } from './bucket-registry';
import {
  FILE_STORAGE_OPTIONS,
  type FileStorageInfrastructureOptions,
} from './file-storage.config';
import { FileStorageHttpController } from './file-storage-http.controller';
import { MinioFileStorageAdapter } from './minio-file-storage.adapter';
import { bucketTokenFor } from './use-bucket.decorator';

/**
 * Динамический модуль файлового хранилища.
 *
 * - `forRoot(options)` — провайдит адаптер `InterFileStoragePort` (токен `INTER_FILE_STORAGE`)
 *   и стартует `OnApplicationBootstrap` хук с `ensureBucketExists`. Глобальный — токен
 *   доступен `forFeature`-ам без явного импорта.
 * - `forFeature(consumers)` — для каждого `@UseBucket`-класса регистрирует фабрику
 *   `bucketTokenFor(class)`, которая отдаёт `InterFileStorageBucket`. Импортируется в модуле
 *   расширения, где живут эти сервисы.
 */
@Global()
@Module({})
export class FileStorageInfrastructureModule {
  static forRoot(options: FileStorageInfrastructureOptions): DynamicModule {
    return {
      module: FileStorageInfrastructureModule,
      controllers: [FileStorageHttpController],
      providers: [
        { provide: FILE_STORAGE_OPTIONS, useValue: options },
        MinioFileStorageAdapter,
        { provide: INTER_FILE_STORAGE, useExisting: MinioFileStorageAdapter },
      ],
      exports: [INTER_FILE_STORAGE, MinioFileStorageAdapter],
    };
  }

  static forFeature(consumers: ReadonlyArray<Type<unknown>>): DynamicModule {
    const providers = consumers.map((cls) => {
      const spec = BucketRegistry.get(cls);
      if (!spec) {
        throw new Error(
          `FileStorageInfrastructureModule.forFeature: класс ${cls.name} не помечен @UseBucket`,
        );
      }
      return {
        provide: bucketTokenFor(cls),
        useFactory: (port: InterFileStoragePort) => port.getBucket(spec),
        inject: [INTER_FILE_STORAGE],
      };
    });
    return {
      module: FileStorageInfrastructureModule,
      providers,
      exports: providers.map((p) => p.provide),
    };
  }
}
