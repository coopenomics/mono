# FileStorage

Универсальное файловое хранилище контура кооператива (MinIO в v1, готовность к нативному S3).
Подробности и архитектура — req **«SPEC: файловое хранилище v1»** в blago.

## Когда использовать

Расширению нужно положить и потом отдать пайщику бинарный файл — изображение, PDF, в перспективе
любой другой blob. Не катить свой S3-клиент и не плодить ad-hoc эндпоинты.

## Минимальный пример

### 1. Сервис расширения декларирует свой бакет

```ts
// extensions/stol-zakazov/order-images.service.ts
import { Injectable } from '@nestjs/common';
import {
  InjectBucket,
  UseBucket,
  type InterFileStorageBucket,
} from '~/infrastructure/file-storage';
import type { FileUpload } from 'graphql-upload';

const MB = 1024 * 1024;

@UseBucket({
  name: 'stol-zakazov:images',
  maxBytes: 10 * MB,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
  metadataSchema: { ownerId: 'required', orderId: 'required' },
  defaultUrlTtlSeconds: 600,
})
@Injectable()
export class OrderImagesService {
  constructor(@InjectBucket() private readonly bucket: InterFileStorageBucket) {}

  async attach(orderId: string, ownerId: string, upload: FileUpload): Promise<string> {
    const key = `orders/${orderId}/main.${ext(upload.mimetype)}`;
    await this.bucket.put(key, upload.createReadStream(), {
      contentType: upload.mimetype,
      metadata: { ownerId, orderId },
    });
    return key;
  }

  async displayUrl(key: string): Promise<string> {
    return this.bucket.getReadUrl(key);
  }

  async remove(key: string): Promise<void> {
    await this.bucket.delete(key); // идемпотентно
  }
}
```

**Конвенция:** один бакет — один сервис. Нужен второй бакет — сделай второй сервис.

### 2. Модуль расширения регистрирует сервис в `forFeature`

```ts
// extensions/stol-zakazov/stol-zakazov.module.ts
import { Module } from '@nestjs/common';
import { FileStorageInfrastructureModule } from '~/infrastructure/file-storage';
import { OrderImagesService } from './order-images.service';

@Module({
  imports: [FileStorageInfrastructureModule.forFeature([OrderImagesService])],
  providers: [OrderImagesService],
  exports: [OrderImagesService],
})
export class StolZakazovModule {}
```

`forFeature` читает `@UseBucket` метадату каждого класса и провайдит ему конкретный
`InterFileStorageBucket` (с уже подмешанным префиксом). Корневой `forRoot(...)` уже подключён
в `app.module.ts`.

### 3. GraphQL — обычная мутация с Upload и поле URL в ответе

```graphql
type Mutation {
  createOrderItem(input: CreateOrderItemInput!): OrderItem!
}

input CreateOrderItemInput {
  title: String!
  image: Upload!
}

type OrderItem {
  id: ID!
  title: String!
  imageUrl: String! # резолвер: bucket.getReadUrl(key) после ACL-проверки
}
```

UI ходит обычным `<img src={imageUrl}>`. Никакого нового REST-слоя для GraphQL-клиента —
служебная ручка `/api/storage/...` живёт сама и видит только подписанные URL.

## Операции

| Метод | Что делает | Гарантии |
|---|---|---|
| `put(key, body, opts)` | Загружает объект | Перезапись по тому же ключу, валидация `maxBytes`/`allowedMime`/`metadataSchema` |
| `getReadUrl(key, opts?)` | Короткоживущий URL чтения | HMAC-signed URL контроллера; TTL по умолчанию из `defaultUrlTtlSeconds` спеки |
| `delete(key)` | Удалить | Идемпотентно (нет объекта = успех) |
| `head(key)` | Метаданные без скачивания | Бросает `InterFileStorageObjectNotFoundError` если нет |

`body` принимает `Uint8Array` или `ReadableStream<Uint8Array>` (graphql-upload `createReadStream()`
также подходит — duck-typed, проверяется наличие `getReader()` или конвертируется адаптером).

## Ошибки

Всё — наследники `InterFileStorageError`. Доменный код мапит на свои коды:

- `InterFileStorageObjectNotFoundError` — нет объекта (`head`)
- `InterFileStorageObjectTooLargeError` — превышен `maxBytes`
- `InterFileStorageMimeRejectedError` — `contentType` не в `allowedMime`
- `InterFileStorageMetadataValidationError` — нет required-метаданного
- `InterFileStorageBackendUnavailableError` — недоступен MinIO/S3
- `InterFileStorageBucketNotConfiguredError` — невалидная спека бакета

## Конфигурация (env)

| Переменная | Default | Заметка |
|---|---|---|
| `MINIO_ENDPOINT` | `http://minio:9000` | Compose service name; для запуска контроллера на хосте — `http://127.0.0.1:9000` |
| `MINIO_ACCESS_KEY` | `minioadmin` | Только dev; на prod подменяется плейбуком |
| `MINIO_SECRET_KEY` | `minioadmin` | То же |
| `MINIO_BUCKET` | `coop-${COOPNAME}` | Физический бакет, идемпотентно создаётся на bootstrap |
| `FILE_STORAGE_SIGNING_SECRET` | `SERVER_SECRET` | HMAC-секрет; на prod — отдельный |
| `FILE_STORAGE_PUBLIC_BASE_URL` | `BACKEND_URL` | База URL для read-ссылок |

## Тесты

```bash
# Юнит (моки)
cd components/controller && npx jest src/infrastructure/file-storage/ -i

# Интеграционные против реального MinIO
docker compose up -d minio                              # из mono-ai-3 root
cd components/controller
npm run test:integration:file-storage
```

Тесты пропускаются автоматически (с диагностическим warning), если MinIO недоступен на
`FILE_STORAGE_TEST_MINIO_ENDPOINT` (default `http://localhost:9000`).

## Что в коробке (файлы модуля)

- `file-storage.config.ts` — `FileStorageInfrastructureOptions` + токен `FILE_STORAGE_OPTIONS`
- `bucket-registry.ts` — singleton, накапливает `BucketSpec` от декораторов
- `use-bucket.decorator.ts` — `@UseBucket`/`@InjectBucket` + `bucketTokenFor`
- `minio-file-storage.adapter.ts` — реализация `InterFileStoragePort` поверх `@aws-sdk/client-s3`,
  валидация спеки, `OnApplicationBootstrap` с `ensureBucketExists`
- `signing.ts` — `signReadUrl` / `verifyReadUrl` (HMAC-SHA256, constant-time)
- `file-storage-http.controller.ts` — `GET /api/storage/:bucket/:key` с проверкой подписи
- `file-storage-infrastructure.module.ts` — `FileStorageModule.forRoot(...) / forFeature(consumers)`

## Не входит в v1

- `getWriteUrl()` (presigned PUT)
- `list(prefix)`, `copy(src, dst)`
- Lifecycle/retention на уровне порта
- Привязка URL к userId (отдельный режим, если появится особо приватный контент)
- Антивирусное сканирование

См. §11 спеки.
