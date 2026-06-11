import { Inject, Injectable } from '@nestjs/common';
import {
  CERT_TTL_DEFAULT_SECONDS,
  CERT_TTL_MAX_SECONDS,
  CERT_TTL_MIN_SECONDS,
  COOP_SETTINGS_REPOSITORY,
} from '~/domain/auth-v2/ports/coop-settings.port';
import type { ICoopSettingsRepository } from '~/domain/auth-v2/ports/coop-settings.port';

/** Зажать TTL в допустимые пределы MVP [MIN, MAX] (Story 4.6). */
function clampTtl(seconds: number): number {
  return Math.min(CERT_TTL_MAX_SECONDS, Math.max(CERT_TTL_MIN_SECONDS, Math.floor(seconds)));
}

/**
 * Срок жизни participant_certificate как продуктовая настройка кооператива
 * (Story 4.6). Источник — coop_domain_db.coop_settings.cert_ttl_seconds.
 * Инвариант: и читаемое, и записываемое значение всегда в пределах [60с, 24ч];
 * пустая/сбойная БД → дефолт 3600 (1ч). Короткий TTL ограничивает окно атаки при
 * компрометации ключа (compensating control к отсутствию офлайн-revocation, Story 4.4).
 */
@Injectable()
export class CertSettingsService {
  constructor(
    @Inject(COOP_SETTINGS_REPOSITORY) private readonly settingsRepo: ICoopSettingsRepository,
  ) {}

  /** TTL сертификата (сек). Пусто/нечисло/сбой репозитория → дефолт; иначе зажат в пределы. */
  async getCertTtlSeconds(): Promise<number> {
    let raw: number | null;
    try {
      raw = await this.settingsRepo.getCertTtlSeconds();
    } catch {
      raw = null;
    }
    if (raw === null || !Number.isFinite(raw)) return CERT_TTL_DEFAULT_SECONDS;
    return clampTtl(raw);
  }

  /**
   * Изменить TTL (председатель). Значение зажимается в [60с, 24ч] (инвариант MVP),
   * сохраняется и возвращается фактически записанным — чтобы вызывающий мог сообщить
   * «зажато до Nч». Эндпоинт под chairman-guard — отдельная история (CASL, Эпик 6).
   */
  async setCertTtlSeconds(seconds: number): Promise<number> {
    const effective = Number.isFinite(seconds) ? clampTtl(seconds) : CERT_TTL_DEFAULT_SECONDS;
    await this.settingsRepo.setCertTtlSeconds(effective);
    return effective;
  }
}
