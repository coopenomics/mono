import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { InnerFileStorageBucket, IUserAvatarPort } from '@coopenomics/innercoop';
import { InjectBucket, UseBucket } from '~/infrastructure/file-storage';
import { AVATAR_BUCKET, type AvatarAllowedMime } from '~/domain/user/constants/avatar-bucket';
import { USER_REPOSITORY, type UserRepository } from '~/domain/user/repositories/user.repository';
import { DomainError } from '@coopenomics/extension-kit';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Фотография пайщика: одна на аккаунт, хранится в ядре и показывается всюду,
 * где платформа рисует человека, — в удостоверении пайщика и на столах
 * расширений. Расширения берут ссылку через порт `USER_AVATAR_PORT` и своей
 * копии файла не держат.
 *
 * Ключ содержательный (`avatars/<username>/<sha256>.<ext>`): повторная загрузка
 * того же снимка не плодит объектов, а прежний файл удаляется сразу — старые
 * портреты кооперативу не нужны.
 */
@UseBucket(AVATAR_BUCKET)
@Injectable()
export class UserAvatarService implements IUserAvatarPort {
  constructor(
    @InjectBucket() private readonly bucket: InnerFileStorageBucket,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository
  ) {}

  /** Загрузка снимка: сам файл в хранилище, в аккаунте остаётся ключ. */
  async upload(username: string, contentBase64: string, mimeType: string): Promise<string> {
    if (!EXTENSION_BY_MIME[mimeType]) {
      throw DomainError.badRequest('ACCOUNT_AVATAR_UNSUPPORTED_TYPE');
    }
    const body = Buffer.from(contentBase64, 'base64');
    if (!body.byteLength) throw DomainError.badRequest('ACCOUNT_AVATAR_EMPTY');
    if (body.byteLength > AVATAR_BUCKET.maxBytes) {
      throw DomainError.badRequest('ACCOUNT_AVATAR_TOO_LARGE', { maxMegabytes: Math.round(AVATAR_BUCKET.maxBytes / (1024 * 1024)) });
    }

    const user = await this.users.findByUsername(username);
    if (!user) throw DomainError.badRequest('ACCOUNT_AVATAR_MEMBER_NOT_FOUND', { username });

    const hash = createHash('sha256').update(body).digest('hex');
    const key = `avatars/${username}/${hash}.${EXTENSION_BY_MIME[mimeType]}`;
    await this.bucket.put(key, new Uint8Array(body), { contentType: mimeType as AvatarAllowedMime });

    const previous = user.avatar_key;
    await this.users.updateByUsername(username, { avatar_key: key, avatar_mime: mimeType });
    if (previous && previous !== key) await this.deleteQuietly(previous);

    return this.bucket.getReadUrl(key);
  }

  /** Снять фотографию: в удостоверении снова остаются инициалы. */
  async remove(username: string): Promise<void> {
    const user = await this.users.findByUsername(username);
    // Ключ запоминаем до обновления: запись аккаунта может быть тем же объектом,
    // и после очистки читать из неё уже нечего.
    const key = user?.avatar_key;
    if (!key) return;
    await this.users.updateByUsername(username, { avatar_key: null, avatar_mime: null });
    await this.deleteQuietly(key);
  }

  async getAvatarUrl(username: string): Promise<string | null> {
    const user = await this.users.findByUsername(username);
    if (!user?.avatar_key) return null;
    return this.bucket.getReadUrl(user.avatar_key);
  }

  async getAvatarUrls(usernames: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(usernames.filter(Boolean))];
    const result = new Map<string, string>();
    await Promise.all(
      unique.map(async (username) => {
        const url = await this.getAvatarUrl(username);
        if (url) result.set(username, url);
      })
    );
    return result;
  }

  /**
   * Прежний файл удаляется мимоходом: аккаунт уже показывает новый снимок, и
   * ради уборки в хранилище загрузку ронять нечем.
   */
  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.bucket.delete(key);
    } catch {
      // объект мог быть удалён раньше — это не мешает
    }
  }
}
