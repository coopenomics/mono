import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectBucket, UseBucket } from '~/infrastructure/file-storage';
import type { InterFileStorageBucket } from '@coopenomics/inter';
import type { MarketplaceOfferImage } from '../../domain/entities/marketplace-offer.types';

const MB = 1024 * 1024;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface MarketplaceOfferImageUploadInput {
  /** Сырое содержимое файла. */
  bytes: Uint8Array;
  /** MIME-тип; должен быть в `ALLOWED_MIME`, иначе bucket бросит `MimeRejected`. */
  contentType: string;
  /** Кооператив (часть ключа bucket'а + метадата аудита). */
  coopname: string;
  /** Аккаунт поставщика, загружающего изображение (метадата для аудита). */
  ownerAccount: string;
}

/**
 * Story 3.2 (доп.): загрузка изображений товара для Offer'а. Зеркало
 * `MarketplaceReturnClaimImagesService` — один сервис на bucket
 * `stol-zakazov:images` (AR31), тот же бакет, что и фото гарантийного
 * возврата (convention из README модуля file-storage: один бакет = один
 * сервис, но физически объекты разнесены по префиксу ключа).
 *
 * Ключ — content-addressed: `offers/<coopname>/<owner>/<sha256>.<ext>`.
 * Это делает повторную загрузку того же файла идемпотентной (один и тот же
 * объект), а sha256 одновременно служит `content_hash` для аудита/дедупа.
 * offerId в ключ НЕ входит намеренно — изображения грузятся до вставки строки
 * Offer'а (id ещё не присвоен), а content-addressing снимает проблему порядка.
 */
@UseBucket({
  name: 'stol-zakazov:images',
  maxBytes: 10 * MB,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
  metadataSchema: { ownerAccount: 'required', coopname: 'required' },
  defaultUrlTtlSeconds: 600,
})
@Injectable()
export class MarketplaceOfferImagesService {
  constructor(@InjectBucket() private readonly bucket: InterFileStorageBucket) {}

  /**
   * Сохраняет один файл в bucket и возвращает доменный снапшот изображения
   * (ключ, sha256-хеш контента, MIME). Повторная загрузка идентичного файла
   * даёт тот же ключ (перезапись тем же содержимым — no-op по смыслу).
   */
  async putImage(input: MarketplaceOfferImageUploadInput): Promise<MarketplaceOfferImage> {
    if (!ALLOWED_MIME.includes(input.contentType as (typeof ALLOWED_MIME)[number])) {
      throw new Error(
        `Поддерживаются только изображения JPEG/PNG/WEBP; получен ${input.contentType}.`
      );
    }

    const contentHashHex = createHash('sha256').update(input.bytes).digest('hex');
    const ext = this.extFromMime(input.contentType);
    const key = `offers/${input.coopname}/${input.ownerAccount}/${contentHashHex}.${ext}`;

    await this.bucket.put(key, input.bytes, {
      contentType: input.contentType,
      metadata: {
        ownerAccount: input.ownerAccount,
        coopname: input.coopname,
      },
    });

    return {
      bucket_key: key,
      content_hash: contentHashHex,
      mime_type: input.contentType,
    };
  }

  /**
   * HMAC-подписанный URL для чтения изображения (TTL по умолчанию из
   * `defaultUrlTtlSeconds` спеки бакета). UI отображает фото через этот URL.
   */
  async getReadUrl(bucketKey: string): Promise<string> {
    return this.bucket.getReadUrl(bucketKey);
  }

  /**
   * Удаляет orphaned-объект — вызывается при провале сохранения Offer'а,
   * чтобы не оставлять мёртвые файлы в `stol-zakazov:images`.
   */
  async deleteImage(bucketKey: string): Promise<void> {
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
