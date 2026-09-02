import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { InnerFileStorageBucket } from '@coopenomics/innercoop';
import { InjectBucket, UseBucket } from '@coopenomics/extension-kit';
import type { EduCourseImage } from '../../infrastructure/entities/edubridge-course.entity';

const MB = 1024 * 1024;

export const EDU_COURSE_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const EDU_COURSE_IMAGE_MAX_BYTES = 10 * MB;

export interface EduCourseImageUpload {
  bytes: Uint8Array;
  contentType: string;
  coopname: string;
  /** Кто загрузил — владелец или администратор; метадата для аудита. */
  ownerAccount: string;
}

/**
 * Изображение курса — обложка карточки в каталоге. Механика та же, что у
 * изображений товара в «Столе заказов»: байты приходят base64 внутри обычной
 * мутации, ложатся в bucket ядра (`FILE_STORAGE_PORT`), в базе хранится только
 * ключ, а ссылка на чтение подписывается лениво при отдаче курса.
 *
 * Ключ content-addressed: `courses/<coopname>/<sha256>.<ext>` — повторная
 * загрузка того же файла идемпотентна, а sha256 служит хэшем содержимого.
 */
@UseBucket({
  name: 'edubridge:images',
  maxBytes: EDU_COURSE_IMAGE_MAX_BYTES,
  allowedMime: [...EDU_COURSE_IMAGE_MIME],
  metadataSchema: { ownerAccount: 'required', coopname: 'required' },
  defaultUrlTtlSeconds: 600,
})
@Injectable()
export class EdubridgeCourseImagesService {
  constructor(@InjectBucket() private readonly bucket: InnerFileStorageBucket) {}

  async putImage(input: EduCourseImageUpload): Promise<EduCourseImage> {
    if (!(EDU_COURSE_IMAGE_MIME as readonly string[]).includes(input.contentType)) {
      throw new Error(`Поддерживаются только изображения JPEG, PNG и WEBP; получен ${input.contentType}.`);
    }
    if (!input.bytes?.length) throw new Error('Пустой файл изображения — загружать нечего.');

    const content_hash = createHash('sha256').update(input.bytes).digest('hex');
    const key = `courses/${input.coopname}/${content_hash}.${this.ext(input.contentType)}`;
    await this.bucket.put(key, input.bytes, {
      contentType: input.contentType,
      metadata: { ownerAccount: input.ownerAccount, coopname: input.coopname },
    });
    return { bucket_key: key, content_hash, mime_type: input.contentType };
  }

  getReadUrl(bucketKey: string): Promise<string> {
    return this.bucket.getReadUrl(bucketKey);
  }

  /** Best-effort: объект мог быть уже удалён или переиспользован другим курсом. */
  async deleteImage(bucketKey: string): Promise<void> {
    await this.bucket.delete(bucketKey).catch(() => undefined);
  }

  private ext(mime: string): string {
    return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  }
}
