import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DomainError } from '@coopenomics/extension-kit';
import type { ICooperativeLogoPort } from '@coopenomics/innercoop';
import { InjectBucket, UseBucket } from '~/infrastructure/file-storage';
import type { InnerFileStorageBucket } from '@coopenomics/innercoop';
import { SETTINGS_REPOSITORY, type SettingsRepository } from '~/domain/settings/repositories/settings.repository';
import { COOP_LOGO_BUCKET, type CoopLogoAllowedMime } from '~/domain/user/constants/coop-logo-bucket';
import config from '~/config/config';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Логотип кооператива — отдельное поле в настройках узла, а не копия в каждом
 * расширении. Загружает его председатель на столе администратора; стол заказов
 * читает ссылку через порт `COOPERATIVE_LOGO_PORT` и показывает тот же кружок
 * в шапке профиля кооператива.
 *
 * Ключ содержательный (`coop-logo/<coopname>/<sha256>.<ext>`): повторная
 * загрузка того же файла не плодит объектов, прежний файл удаляется сразу.
 */
@UseBucket(COOP_LOGO_BUCKET)
@Injectable()
export class CooperativeLogoService implements ICooperativeLogoPort {
  constructor(
    @InjectBucket() private readonly bucket: InnerFileStorageBucket,
    @Inject(SETTINGS_REPOSITORY) private readonly settings: SettingsRepository
  ) {}

  /** Загрузить логотип: файл в хранилище, ключ — в настройках кооператива. */
  async upload(contentBase64: string, mimeType: string): Promise<string> {
    if (!EXTENSION_BY_MIME[mimeType]) {
      throw DomainError.badRequest('COOP_LOGO_UNSUPPORTED_TYPE');
    }
    const body = Buffer.from(contentBase64, 'base64');
    if (!body.byteLength) throw DomainError.badRequest('COOP_LOGO_EMPTY');
    if (body.byteLength > COOP_LOGO_BUCKET.maxBytes) {
      throw DomainError.badRequest('COOP_LOGO_TOO_LARGE', {
        maxMegabytes: Math.round(COOP_LOGO_BUCKET.maxBytes / (1024 * 1024)),
      });
    }

    const coopname = config.coopname;
    const hash = createHash('sha256').update(body).digest('hex');
    const key = `coop-logo/${coopname}/${hash}.${EXTENSION_BY_MIME[mimeType]}`;
    await this.bucket.put(key, new Uint8Array(body), { contentType: mimeType as CoopLogoAllowedMime });

    const previous = await this.settings.get(coopname);
    const previousKey = previous?.logo_key ?? null;
    await this.settings.update(coopname, { logo_key: key, logo_mime: mimeType });
    if (previousKey && previousKey !== key) await this.deleteQuietly(previousKey);

    return this.bucket.getReadUrl(key);
  }

  /** Снять логотип — в шапке снова останутся инициалы. */
  async remove(): Promise<void> {
    const coopname = config.coopname;
    const settings = await this.settings.get(coopname);
    const key = settings?.logo_key ?? null;
    if (!key) return;
    await this.settings.update(coopname, { logo_key: null, logo_mime: null });
    await this.deleteQuietly(key);
  }

  /** Ссылка на логотип для столов; подписанная, живёт по TTL бакета. */
  async getLogoUrl(): Promise<string | null> {
    const settings = await this.settings.get(config.coopname);
    return settings?.logo_key ? this.bucket.getReadUrl(settings.logo_key) : null;
  }

  /** Уборка файла не роняет загрузку: новый логотип уже показан. */
  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.bucket.delete(key);
    } catch {
      // объект мог быть удалён раньше — это не мешает
    }
  }
}
