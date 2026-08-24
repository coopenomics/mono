import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { InnerFileStorageBucket } from '@coopenomics/innercoop';
import { InjectBucket, UseBucket } from '~/infrastructure/file-storage';
import {
  COOPERATIVE_CHARTER_REPOSITORY,
  type CooperativeCharterRepository,
} from '~/domain/cooperative-charter/repositories/cooperative-charter.repository';
import type { ICooperativeCharterDatabaseData } from '~/domain/cooperative-charter/interfaces/cooperative-charter-database.interface';
import {
  CHARTER_BUCKET,
  CHARTER_EXTENSION_BY_MIME,
} from '~/domain/cooperative-charter/constants/charter-bucket';
import { UploadCooperativeCharterInputDTO } from '../dto/upload-cooperative-charter.input';

/**
 * Уставы кооперативов, приложенные к заявке на подключение.
 *
 * Кооператив прикладывает устав на первом шаге мастера подключения — до того,
 * как он появится в `registrator.coops` (запись создаётся только при подписании
 * соглашения). Поэтому привязка идёт к аккаунту (`username`), а не к записи
 * кооператива, и загрузка доступна обычному пайщику-организации.
 *
 * Совет читает устав в реестре кооперативов, когда решает, подтверждать ли
 * подключение: рассказ о деятельности лежит on-chain в `coops.description`, а
 * сам документ — здесь.
 */
@UseBucket(CHARTER_BUCKET)
@Injectable()
export class CooperativeCharterService {
  constructor(
    @InjectBucket() private readonly bucket: InnerFileStorageBucket,
    @Inject(COOPERATIVE_CHARTER_REPOSITORY) private readonly charters: CooperativeCharterRepository
  ) {}

  async upload(
    input: UploadCooperativeCharterInputDTO,
    uploadedByUsername: string
  ): Promise<{ data: ICooperativeCharterDatabaseData; readUrl: string }> {
    const body = Buffer.from(input.content_base64, 'base64');
    if (body.byteLength !== input.size_bytes) {
      throw new BadRequestException(
        `size_bytes (${input.size_bytes}) не совпадает с фактическим размером base64-содержимого (${body.byteLength}).`
      );
    }
    const actualChecksum = createHash('sha256').update(body).digest('hex');
    if (actualChecksum !== input.checksum_sha256.toLowerCase()) {
      throw new BadRequestException('checksum_sha256 не совпадает с реальным SHA-256 содержимого.');
    }

    const existing = await this.charters.findLatestByUsername(input.coopname, input.username);
    if (existing && existing.checksum_sha256 === actualChecksum) {
      // Тот же файл уже приложен: повторная отправка — это, как правило, второй
      // клик по кнопке, а не новая редакция устава.
      throw new ConflictException('Этот же файл устава уже приложен к заявке.');
    }

    const storageKey = this.buildKey({
      coopname: input.coopname,
      username: input.username,
      checksum: actualChecksum,
      mimeType: input.mime_type,
    });

    await this.bucket.put(storageKey, new Uint8Array(body), { contentType: input.mime_type });

    const saved = await this.charters.create({
      coopname: input.coopname,
      username: input.username,
      checksum_sha256: actualChecksum,
      mime_type: input.mime_type,
      size_bytes: body.byteLength,
      storage_key: storageKey,
      original_filename: input.original_filename ?? null,
      uploaded_by_username: uploadedByUsername,
      uploaded_at: new Date(),
    });

    return { data: saved, readUrl: await this.bucket.getReadUrl(storageKey) };
  }

  /** Последний устав кооператива вместе со свежей ссылкой на скачивание. */
  async getLatest(
    coopname: string,
    username: string
  ): Promise<{ data: ICooperativeCharterDatabaseData; readUrl: string } | null> {
    const charter = await this.charters.findLatestByUsername(coopname, username);
    if (!charter) return null;
    return { data: charter, readUrl: await this.bucket.getReadUrl(charter.storage_key) };
  }

  async getReadUrl(id: number): Promise<{ data: ICooperativeCharterDatabaseData; readUrl: string }> {
    const charter = await this.charters.findById(id);
    if (!charter) throw new NotFoundException(`Устав #${id} не найден.`);
    return { data: charter, readUrl: await this.bucket.getReadUrl(charter.storage_key) };
  }

  /**
   * Уставы сразу для списка кооперативов — реестр совета рисуется одним
   * запросом, без похода в хранилище на каждую строку. Ссылки на скачивание
   * здесь не выдаём: они короткоживущие, их берут по клику отдельным запросом.
   */
  async listLatestFor(coopname: string, usernames: string[]): Promise<Map<string, ICooperativeCharterDatabaseData>> {
    const found = await this.charters.findLatestForUsernames(coopname, usernames);
    return new Map(found.map((charter) => [charter.username, charter]));
  }

  private buildKey(params: {
    coopname: string;
    username: string;
    checksum: string;
    mimeType: string;
  }): string {
    const ext = CHARTER_EXTENSION_BY_MIME[params.mimeType] ?? 'bin';
    return `${params.coopname}/registrator/${params.username}/charter/${params.checksum}.${ext}`;
  }
}
