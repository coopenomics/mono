import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectBucket, UseBucket } from '~/infrastructure/file-storage';
import type { InnerFileStorageBucket } from '@coopenomics/innercoop';
import type { MarketplaceReturnClaimPhoto } from '../../domain/entities/marketplace-return-claim.types';

const MB = 1024 * 1024;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface MarketplaceReturnClaimImageUploadInput {
  /** Сырое содержимое файла. */
  bytes: Uint8Array;
  /** MIME-тип; должен быть в `ALLOWED_MIME`, иначе bucket бросит `MimeRejected`. */
  contentType: string;
  /** Идентификатор заявления (используется как часть ключа bucket'а). */
  claimId: string;
  /** Источник фото: 'orderer' (приложение пайщика) или 'on_site' (очный осмотр). */
  role: 'orderer' | 'on_site';
  /** Аккаунт пайщика/председателя, загружающего фото (метадата для аудита). */
  ownerAccount: string;
  /** Связанный Order (метадата для аудита). */
  orderId: string;
  /** Порядковый номер фото в наборе (нужен для уникального ключа). */
  index: number;
}

/**
 * Story 7.1 / 7.3 (AR31, AR32): загрузка фотографий, прилагаемых к
 * заявлению на гарантийный возврат и к очному осмотру. Один сервис на
 * bucket `stol-zakazov:images` — convention из README модуля file-storage
 * (один бакет на один сервис).
 *
 * Backend хеширует содержимое (sha256) и кладёт в bucket по детерминированному
 * ключу `returns/<claim_id>/<role>/<index>.<ext>`. SHA256-хеш файла
 * используется как `photos[i]` в параметре `submretrn` on-chain (фото
 * становятся проверяемыми артефактами — UI может сопоставить bucket-объект
 * и on-chain checksum256).
 */
@UseBucket({
  name: 'stol-zakazov:images',
  maxBytes: 10 * MB,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
  metadataSchema: { ownerAccount: 'required', orderId: 'required', claimId: 'required' },
  defaultUrlTtlSeconds: 600,
})
@Injectable()
export class MarketplaceReturnClaimImagesService {
  constructor(@InjectBucket() private readonly bucket: InnerFileStorageBucket) {}

  /**
   * Сохраняет один файл в bucket и возвращает доменный снапшот фото
   * (ключ, sha256-хеш контента, MIME, время загрузки).
   */
  async putPhoto(input: MarketplaceReturnClaimImageUploadInput): Promise<MarketplaceReturnClaimPhoto> {
    if (!ALLOWED_MIME.includes(input.contentType as (typeof ALLOWED_MIME)[number])) {
      throw new Error(
        `Поддерживаются только изображения JPEG/PNG/WEBP; получен ${input.contentType}.`
      );
    }

    const contentHashHex = createHash('sha256').update(input.bytes).digest('hex');
    const ext = this.extFromMime(input.contentType);
    const key = `returns/${input.claimId}/${input.role}/${input.index}.${ext}`;

    await this.bucket.put(key, input.bytes, {
      contentType: input.contentType,
      metadata: {
        ownerAccount: input.ownerAccount,
        orderId: input.orderId,
        claimId: input.claimId,
      },
    });

    return {
      bucket_key: key,
      content_hash: contentHashHex,
      mime_type: input.contentType,
      uploaded_at: new Date(),
    };
  }

  /**
   * Возвращает HMAC-подписанный URL для чтения фото (TTL по умолчанию из
   * `defaultUrlTtlSeconds` спеки бакета). UI отображает фото через этот URL.
   */
  async getReadUrl(bucketKey: string): Promise<string> {
    return this.bucket.getReadUrl(bucketKey);
  }

  /**
   * Удаляет orphaned-объект из bucket'а — вызывается из сервиса при провале
   * on-chain submit'а, чтобы не оставлять mёртвые файлы в `stol-zakazov:images`.
   */
  async deletePhoto(bucketKey: string): Promise<void> {
    await this.bucket.delete(bucketKey);
  }

  private extFromMime(mime: string): string {
    switch (mime) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'bin';
    }
  }
}
