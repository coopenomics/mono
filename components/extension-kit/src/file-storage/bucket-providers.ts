import type { Provider } from '@nestjs/common';
import { BucketRegistry, bucketTokenFor, type BucketSpec } from './bucket';

/**
 * Источник хранилищ — та сторона, что умеет создать хранилище по объявлению.
 * Описан структурно, а не импортом `IFileStoragePort` из `@coopenomics/innercoop`:
 * пакеты ортогональны (INV-007), совместимость проверяется по форме.
 */
export interface BucketSource {
  getBucket(spec: BucketSpec): unknown;
}

/**
 * Провайдеры хранилищ для сервисов, объявивших их через `@UseBucket`.
 *
 * Расширение кладёт результат прямо в `providers` своего модуля — рядом с самими
 * сервисами, — и каждый из них получает своё хранилище через `@InjectBucket()`.
 * Раньше ту же связку делал динамический модуль ядра (`forFeature`), то есть
 * расширению приходилось знать путь внутрь монолита; теперь всё, что для этого
 * нужно, лежит в каркасе, а токен порта расширение передаёт само — оно и так
 * зависит от контракта, а каркас про контракт по-прежнему не знает.
 *
 * @param fileStoragePortToken токен стороны, создающей хранилища (`FILE_STORAGE_PORT`).
 * @param consumers классы, помеченные `@UseBucket`.
 *
 * @example
 * ```ts
 * @Module({
 *   providers: [
 *     ...bucketProvidersFor(FILE_STORAGE_PORT, [OrderImagesService]),
 *     OrderImagesService,
 *   ],
 * })
 * ```
 */
export function bucketProvidersFor(
  fileStoragePortToken: symbol | string,
  consumers: ReadonlyArray<{ name: string }>
): Provider[] {
  return consumers.map((cls) => {
    const spec = BucketRegistry.get(cls);
    if (!spec) {
      throw new Error(
        `bucketProvidersFor: класс ${cls.name} не помечен @UseBucket — объявите хранилище рядом с сервисом`
      );
    }
    return {
      provide: bucketTokenFor(cls),
      useFactory: (source: BucketSource) => source.getBucket(spec),
      inject: [fileStoragePortToken],
    };
  });
}
