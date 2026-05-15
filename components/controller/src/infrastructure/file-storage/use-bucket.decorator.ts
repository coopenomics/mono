import { Inject } from '@nestjs/common';
import type { InterFileStorageBucketSpec } from '@coopenomics/inter';
import { BucketRegistry } from './bucket-registry';

/**
 * DI-токен per-class бакета, под которым `forFeature` регистрирует фабрику `BucketHandle`.
 * Конструктор `@InjectBucket()` инжектится по этому токену.
 */
export function bucketTokenFor(cls: { name: string }): string {
  return `__InterFileStorageBucket:${cls.name}`;
}

/**
 * Класс-декоратор: декларирует бакет, в который пишет данный сервис.
 * Конвенция — один бакет на один сервис; повторная регистрация под другим именем запрещена.
 *
 * @example
 * ```ts
 * @UseBucket({ name: 'stol-zakazov:images', maxBytes: 10*MB, allowedMime: ['image/jpeg'] })
 * @Injectable()
 * export class OrderImagesService {
 *   constructor(@InjectBucket() private readonly bucket: InterFileStorageBucket) {}
 * }
 * ```
 */
export function UseBucket(spec: InterFileStorageBucketSpec): ClassDecorator {
  return (target) => {
    BucketRegistry.add(target as unknown as { name: string }, spec);
  };
}

/**
 * Параметр-декоратор: инжектит `InterFileStorageBucket` для текущего класса.
 * Резолвится в DI-токен `bucketTokenFor(<ClassName>)`, который провайдится через
 * `FileStorageInfrastructureModule.forFeature([ThisClass])`.
 */
export function InjectBucket(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const cls = target as unknown as { name: string };
    Inject(bucketTokenFor(cls))(target, propertyKey, parameterIndex);
  };
}
