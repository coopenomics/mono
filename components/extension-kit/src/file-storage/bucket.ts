import { Inject } from '@nestjs/common';

/**
 * Объявление хранилища файлов, которое заводит себе расширение.
 *
 * Форма намеренно повторяет `InnerFileStorageBucketSpec` из
 * `@coopenomics/innercoop`, а не импортируется оттуда: пакеты ортогональны
 * (INV-007), совместимость структурная — как у `PaymentDetails`.
 */
export interface BucketSpec {
  /** Логическое имя в виде `<расширение>:<назначение>`. */
  name: string;
  /** Предел размера одного файла, байт. */
  maxBytes: number;
  /** Разрешённые типы содержимого; всё остальное отвергается на записи. */
  allowedMime: readonly string[];
  /** Какие метаданные обязательны, а какие нет: проверяется при записи. */
  metadataSchema?: Readonly<Record<string, 'required' | 'optional'>>;
  /** Срок жизни ссылки на чтение по умолчанию, секунды. */
  defaultUrlTtlSeconds?: number;
}

export interface RegisteredBucket {
  readonly cls: { readonly name: string };
  readonly spec: BucketSpec;
}

const REGISTERED = new Map<{ name: string }, BucketSpec>();

/**
 * Реестр объявленных хранилищ. Наполняется декоратором при загрузке модулей,
 * читается ядром, когда оно создаёт сами хранилища.
 *
 * Один сервис — одно хранилище: повторное объявление под другим именем
 * запрещено, иначе файлы одного сервиса разъехались бы по двум местам, и
 * прочитать записанное вчера стало бы нечем.
 */
export const BucketRegistry = {
  add(cls: { name: string }, spec: BucketSpec): void {
    const existing = REGISTERED.get(cls);
    if (existing && existing.name !== spec.name) {
      throw new Error(
        `BucketRegistry: класс ${cls.name} уже зарегистрирован под бакетом '${existing.name}', ` +
          `повторная регистрация под '${spec.name}' запрещена`
      );
    }
    REGISTERED.set(cls, spec);
  },

  get(cls: { name: string }): BucketSpec | undefined {
    return REGISTERED.get(cls);
  },

  list(): readonly RegisteredBucket[] {
    return Array.from(REGISTERED.entries()).map(([cls, spec]) => ({ cls, spec }));
  },

  /** Только для тестов: очистка реестра между сценариями. */
  _resetForTests(): void {
    REGISTERED.clear();
  },
};

/** DI-токен хранилища конкретного сервиса. */
export function bucketTokenFor(cls: { name: string }): string {
  return `__InterFileStorageBucket:${cls.name}`;
}

/**
 * Объявить хранилище сервиса.
 *
 * @example
 * ```ts
 * @UseBucket({ name: 'stol-zakazov:images', maxBytes: 10 * MB, allowedMime: ['image/jpeg'] })
 * @Injectable()
 * export class OrderImagesService {
 *   constructor(@InjectBucket() private readonly bucket: InnerFileStorageBucket) {}
 * }
 * ```
 */
export function UseBucket(spec: BucketSpec): ClassDecorator {
  return (target) => {
    BucketRegistry.add(target as unknown as { name: string }, spec);
  };
}

/** Получить объявленное хранилище в конструкторе сервиса. */
export function InjectBucket(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const cls = target as unknown as { name: string };
    Inject(bucketTokenFor(cls))(target, propertyKey, parameterIndex);
  };
}
