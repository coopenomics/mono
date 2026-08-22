import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { InnerFileStorageBucket } from '@coopenomics/innercoop';
import { InjectBucket, UseBucket } from '~/infrastructure/file-storage';
import config from '~/config/config';
import {
  ACCOUNT_BLOCKCHAIN_PORT,
  type AccountBlockchainPort,
} from '~/domain/account/interfaces/account-blockchain.port';
import {
  VERIFICATION_REVIEW_REPOSITORY,
  type IVerificationReviewRepository,
  type VerificationReviewFilter,
} from '~/domain/auth-v2/ports/verification-review.port';
import {
  VerificationReviewStatus,
  type VerificationReview,
  type VerificationReviewPhoto,
} from '~/domain/auth-v2/verification/verification-review.types';
import {
  VERIFICATION_BUCKET,
  VERIFICATION_PHOTOS_MAX,
  VERIFICATION_PHOTO_EXTENSION_BY_MIME,
} from '~/domain/auth-v2/verification/constants/verification-bucket';
import { VerificationProcedure } from '~/domain/auth-v2/verification/verification.types';
import { AuditService } from '../audit/audit.service';
import { VerificationAuthorityService, type VerificationActor } from './verification-authority.service';

/** Снимок сверки, как он приходит с экрана оператора. */
export interface VerificationPhotoUpload {
  content_base64: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  original_filename?: string | null;
}

/** Снимок, прошедший проверку и готовый лечь в хранилище. */
export interface PreparedVerificationPhoto {
  body: Buffer;
  checksum: string;
  mime_type: string;
  original_filename?: string | null;
}

/** Ссылка на снимок для экрана проверки. */
export interface VerificationPhotoLink {
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  read_url: string;
}

/**
 * Журнал верификаций и проверка сверки советом.
 *
 * Личность сверяет кооперативный участок, и уровень выдаётся сразу: иначе
 * пайщик не заберёт заказ, пока не проснётся совет. Снятое ложится сюда со
 * статусом «на проверке», председатель совета утверждает либо отклоняет —
 * отклонение отзывает верификацию с цепи, и выдача снова закрыта.
 *
 * Снимки временные: решение совета их удаляет. Кооперативу нужен факт («перед
 * оператором стоял тот, кто зарегистрирован»), а не копии чужих паспортов.
 *
 * Журнал ведём офчейн, потому что в цепи истории нет: вектор `verifications`
 * хранит текущее состояние, а отзыв запись стирает.
 */
@UseBucket(VERIFICATION_BUCKET)
@Injectable()
export class VerificationReviewService {
  constructor(
    @InjectBucket() private readonly bucket: InnerFileStorageBucket,
    @Inject(VERIFICATION_REVIEW_REPOSITORY) private readonly reviews: IVerificationReviewRepository,
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    private readonly authority: VerificationAuthorityService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Проверить снимки до записи в цепь: файл может не сойтись по размеру или
   * контрольной сумме, и узнать об этом после `verifyacc` поздно — верификация
   * уже выдана.
   */
  prepareVerification(braname: string, photos: VerificationPhotoUpload[]): PreparedVerificationPhoto[] {
    if (braname && photos.length === 0) {
      throw new BadRequestException('Приложите хотя бы одну фотографию сверки: пайщика и его паспорт');
    }
    if (photos.length > VERIFICATION_PHOTOS_MAX) {
      throw new BadRequestException(`Можно приложить не больше ${VERIFICATION_PHOTOS_MAX} фотографий`);
    }
    return photos.map((photo) => {
      const body = Buffer.from(photo.content_base64, 'base64');
      if (body.byteLength !== photo.size_bytes) {
        throw new BadRequestException(
          `size_bytes (${photo.size_bytes}) не совпадает с фактическим размером содержимого (${body.byteLength})`,
        );
      }
      const checksum = createHash('sha256').update(body).digest('hex');
      if (checksum !== photo.checksum_sha256.toLowerCase()) {
        throw new BadRequestException('checksum_sha256 не совпадает с реальным SHA-256 содержимого');
      }
      return { body, checksum, mime_type: photo.mime_type, original_filename: photo.original_filename ?? null };
    });
  }

  /**
   * Записать проведённую сверку. С участка запись уходит на проверку совета;
   * сам совет проверять себя не должен, поэтому его сверка сразу утверждённая.
   */
  async recordVerification(params: {
    actor: VerificationActor;
    username: string;
    braname: string;
    photos: PreparedVerificationPhoto[];
  }): Promise<VerificationReview> {
    const { actor, username, braname, photos } = params;
    const byCouncil = !braname;

    const id = randomUUID();
    const stored: VerificationReviewPhoto[] = [];
    for (const photo of photos) {
      stored.push(await this.storePhoto(id, photo));
    }

    const review = await this.reviews.create({
      id,
      username,
      procedure: VerificationProcedure.Passport,
      braname,
      verificator: actor.username,
      status: byCouncil ? VerificationReviewStatus.Approved : VerificationReviewStatus.Pending,
      photos: stored,
    });

    await this.audit.record({
      event: 'ParticipantVerificationRecorded',
      subjectId: username,
      actor: actor.username,
      result: 'success',
      context: { review_id: id, braname, photos: stored.length, status: review.status },
    });

    return review;
  }

  /** Отметить отзыв верификации в журнале: цепь истории не хранит. */
  async recordRevocation(chairman: string, username: string, reason?: string | null): Promise<void> {
    const latest = await this.reviews.findLatestByUsername(username);
    if (!latest) return;
    if (latest.status === VerificationReviewStatus.Rejected || latest.status === VerificationReviewStatus.Revoked) {
      return;
    }
    await this.dropPhotos(latest);
    await this.reviews.decide({
      id: latest.id,
      status: VerificationReviewStatus.Revoked,
      decided_by: chairman,
      decision_reason: reason ?? null,
      clear_photos: true,
    });
  }

  /** Журнал верификаций: что, когда, кем и чем закончилось. */
  async list(actor: VerificationActor, filter: VerificationReviewFilter): Promise<VerificationReview[]> {
    this.authority.assertMayReview(actor);
    return this.reviews.list(filter);
  }

  /** Сколько сверок ждёт решения совета — счётчик на вкладке. */
  async countPending(actor: VerificationActor): Promise<number> {
    this.authority.assertMayReview(actor);
    return this.reviews.countByStatus(VerificationReviewStatus.Pending);
  }

  /**
   * Короткоживущие ссылки на снимки сверки. Открывает их только совет и только
   * пока сверка на проверке: после решения снимков уже нет.
   */
  async photoLinks(actor: VerificationActor, reviewId: string): Promise<VerificationPhotoLink[]> {
    this.authority.assertMayReview(actor);
    const review = await this.requirePending(reviewId);

    await this.audit.record({
      event: 'ParticipantVerificationPhotosViewed',
      subjectId: review.username,
      actor: actor.username,
      result: 'success',
      context: { review_id: review.id, photos: review.photos.length },
    });

    return Promise.all(
      review.photos.map(async (photo) => ({
        storage_key: photo.storage_key,
        mime_type: photo.mime_type,
        size_bytes: photo.size_bytes,
        read_url: await this.bucket.getReadUrl(photo.storage_key),
      })),
    );
  }

  /** Совет подтвердил сверку. На цепи уже всё есть — снимаем только снимки. */
  async approve(actor: VerificationActor, reviewId: string): Promise<VerificationReview> {
    this.authority.assertMayReview(actor);
    const review = await this.requirePending(reviewId);

    await this.dropPhotos(review);
    const decided = await this.reviews.decide({
      id: review.id,
      status: VerificationReviewStatus.Approved,
      decided_by: actor.username,
      clear_photos: true,
    });

    await this.audit.record({
      event: 'ParticipantVerificationApproved',
      subjectId: review.username,
      actor: actor.username,
      result: 'success',
      context: { review_id: review.id, braname: review.braname },
    });

    return decided ?? review;
  }

  /**
   * Совет отклонил сверку: верификация отзывается с цепи, и пайщик снова не
   * может получить имущество, пока не подтвердит личность заново.
   */
  async reject(actor: VerificationActor, reviewId: string, reason: string): Promise<VerificationReview> {
    this.authority.assertMayReview(actor);
    const review = await this.requirePending(reviewId);

    await this.accountBlockchainPort.unverifyAccount({
      coopname: config.coopname,
      chairman: actor.username,
      username: review.username,
      procedure: VerificationProcedure.Passport,
    });

    await this.dropPhotos(review);
    const decided = await this.reviews.decide({
      id: review.id,
      status: VerificationReviewStatus.Rejected,
      decided_by: actor.username,
      decision_reason: reason,
      clear_photos: true,
    });

    await this.audit.record({
      event: 'ParticipantVerificationRejected',
      subjectId: review.username,
      actor: actor.username,
      result: 'success',
      context: { review_id: review.id, braname: review.braname, reason },
    });

    return decided ?? review;
  }

  private async requirePending(reviewId: string): Promise<VerificationReview> {
    const review = await this.reviews.findById(reviewId);
    if (!review) throw new NotFoundException('Запись о сверке личности не найдена');
    if (review.status !== VerificationReviewStatus.Pending) {
      throw new ConflictException('По этой сверке решение уже принято');
    }
    return review;
  }

  /**
   * Снимки удаляем после решения совета — они нужны были только на проверку.
   * Хранилище может не ответить; запись всё равно закрываем, иначе сверка
   * зависнет в очереди, а осиротевший объект удалится следующей попыткой.
   */
  private async dropPhotos(review: VerificationReview): Promise<void> {
    for (const photo of review.photos) {
      try {
        await this.bucket.delete(photo.storage_key);
      } catch {
        // намеренно молча: см. комментарий выше
      }
    }
  }

  private async storePhoto(reviewId: string, photo: PreparedVerificationPhoto): Promise<VerificationReviewPhoto> {
    const ext = VERIFICATION_PHOTO_EXTENSION_BY_MIME[photo.mime_type] ?? 'bin';
    const storage_key = `${config.coopname}/verification/${reviewId}/${photo.checksum}.${ext}`;
    await this.bucket.put(storage_key, new Uint8Array(photo.body), { contentType: photo.mime_type });

    return {
      storage_key,
      checksum_sha256: photo.checksum,
      mime_type: photo.mime_type,
      size_bytes: photo.body.byteLength,
      original_filename: photo.original_filename ?? null,
      uploaded_at: new Date().toISOString(),
    };
  }
}
