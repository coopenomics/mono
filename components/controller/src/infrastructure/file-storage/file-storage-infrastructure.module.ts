import { DynamicModule, Global, Module, type Type } from '@nestjs/common';
import { FILE_STORAGE_PORT, type IFileStoragePort } from '@coopenomics/innercoop';
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
 * - `forRoot(options)` — провайдит адаптер `IFileStoragePort` (токен `FILE_STORAGE_PORT`)
 *   и стартует `OnApplicationBootstrap` хук с `ensureBucketExists`. Глобальный — токен
 *   доступен `forFeature`-ам без явного импорта.
 * - `forFeature(consumers)` — для каждого `@UseBucket`-класса регистрирует фабрику
 *   `bucketTokenFor(class)`, которая отдаёт `InnerFileStorageBucket`. Импортируется в модуле
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
        { provide: FILE_STORAGE_PORT, useExisting: MinioFileStorageAdapter },
      ],
      exports: [FILE_STORAGE_PORT, MinioFileStorageAdapter],
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
        useFactory: (port: IFileStoragePort) => port.getBucket(spec),
        inject: [FILE_STORAGE_PORT],
      };
    });
    return {
      module: FileStorageInfrastructureModule,
      providers,
      exports: providers.map((p) => p.provide),
    };
  }
}
