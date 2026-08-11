import { DynamicModule, Global, Module } from '@nestjs/common';
import { FILE_STORAGE_PORT } from '@coopenomics/innercoop';
import {
  FILE_STORAGE_OPTIONS,
  type FileStorageInfrastructureOptions,
} from './file-storage.config';
import { FileStorageHttpController } from './file-storage-http.controller';
import { MinioFileStorageAdapter } from './minio-file-storage.adapter';

/**
 * Динамический модуль файлового хранилища.
 *
 * `forRoot(options)` провайдит адаптер `IFileStoragePort` (токен `FILE_STORAGE_PORT`)
 * и стартует `OnApplicationBootstrap` хук с `ensureBucketExists`. Модуль глобальный —
 * токен виден всем, в том числе тем, кто заводит себе хранилище.
 *
 * Само хранилище по объявлению `@UseBucket` создаёт `bucketProvidersFor` из
 * `@coopenomics/extension-kit`: связка «объявление → провайдер» живёт в каркасе,
 * чтобы расширению не требовался путь внутрь монолита.
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

}
