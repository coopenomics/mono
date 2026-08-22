import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { tokenTypes } from '~/types/token.types';
import { SESSION_METADATA_PORT } from '~/domain/auth-v2/ports/session-metadata.port';
import type { ISessionMetadataStore } from '~/domain/auth-v2/ports/session-metadata.port';
import { ActiveSession, SESSION_DEVICE_UNKNOWN, SESSION_IP_UNKNOWN } from '~/domain/auth-v2/sessions/session.types';
import { AuditService } from '../audit/audit.service';

export interface RevokeAllResult {
  /** Сколько сессий (refresh-токенов) отозвано. */
  revoked: number;
}

/**
 * Просмотр и отзыв активных сессий пайщика (Story 3.7).
 *
 * **Сессия = персистентный refresh-токен** в платформенном токен-сторе — именно им
 * `VerifyTimestampService` завершает вход CoopID. Отзыв удаляет строку токена, после чего
 * refresh перестаёт верифицироваться (`findByTokenAndTypes` не находит запись) — доступ
 * с устройства прекращается на следующем обновлении access-токена.
 *
 * Метаданные устройства/IP берутся из side-store (Redis), записанного при входе; их
 * отсутствие не скрывает сессию — показываем с заглушками.
 *
 * **Дрейф AC↔код (правим спеку к коду):** исходный AC описывал authentik `oauth_tokens`
 * + `/oauth/revoke`, но в этом контуре сессия живёт на нашем refresh-токене, а authentik —
 * лишь IdP этапа пароля. Geo по IP отложено (нет провайдера, как в 3.8).
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly tokens: TokenApplicationService,
    @Inject(SESSION_METADATA_PORT) private readonly meta: ISessionMetadataStore,
    private readonly audit: AuditService,
  ) {}

  /**
   * Список активных (не истёкших, не отозванных) сессий пайщика.
   *
   * Текущая сессия опознаётся по `sid` из access-токена. Раньше — только сравнением
   * с refresh-токеном, который фронт для этого должен был слать заголовком и не слал:
   * ни одна сессия не помечалась текущей, кнопка «Завершить» появлялась и у своей,
   * а «Завершить все остальные» считало своими чужими все до единой.
   */
  async list(userId: string, currentRefreshToken?: string | null, currentSessionId?: string | null): Promise<ActiveSession[]> {
    const rows = await this.tokens.findActiveByUser(userId, tokenTypes.REFRESH);
    const now = Date.now();
    const active = rows.filter((r) => !r.blacklisted && new Date(r.expires).getTime() > now);

    return Promise.all(
      active.map(async (r) => {
        const m = await this.safeGetMeta(r.token);
        const createdAt = m?.createdAt ?? this.toIso(r.createdAt);
        return {
          id: r.id as string,
          device: m?.device ?? SESSION_DEVICE_UNKNOWN,
          ip: m?.ip ?? SESSION_IP_UNKNOWN,
          createdAt,
          lastSeenAt: m?.lastSeenAt ?? createdAt,
          current: currentSessionId ? r.id === currentSessionId : currentRefreshToken ? r.token === currentRefreshToken : false,
        };
      }),
    );
  }

  /** Отозвать одну сессию по её id. Чужая/несуществующая → 404 (не раскрываем). */
  async revoke(userId: string, sessionId: string, ip: string | null): Promise<void> {
    const rows = await this.tokens.findActiveByUser(userId, tokenTypes.REFRESH);
    const target = rows.find((r) => r.id === sessionId);
    if (!target) throw new NotFoundException('Сессия не найдена');

    await this.tokens.deleteById(sessionId);
    await this.safeDeleteMeta(target.token);
    await this.safeAudit({ event: 'coopid.session.revoked', subjectId: userId, actor: userId, result: 'success', context: { session_id: sessionId }, ip });
  }

  /**
   * Отозвать сессии пайщика, кроме текущей — ровно то, что обещает кнопка
   * «Завершить все остальные». Текущая сохраняется: пайщик разлогинивал сам себя,
   * нажимая кнопку, которая этого не обещала.
   */
  async revokeAll(userId: string, ip: string | null, exceptSessionId?: string | null): Promise<RevokeAllResult> {
    const all = await this.tokens.findActiveByUser(userId, tokenTypes.REFRESH);
    const rows = exceptSessionId ? all.filter((r) => r.id !== exceptSessionId) : all;
    for (const r of rows) {
      if (r.id) await this.tokens.deleteById(r.id);
      await this.safeDeleteMeta(r.token);
    }
    await this.safeAudit({ event: 'coopid.session.revoked_all', subjectId: userId, actor: userId, result: 'success', context: { revoked_count: rows.length }, ip });
    return { revoked: rows.length };
  }

  private toIso(d?: Date): string {
    return d ? new Date(d).toISOString() : new Date().toISOString();
  }

  /** Метаданные — украшение; их недоступность не должна валить список сессий. */
  private async safeGetMeta(token: string) {
    try {
      return await this.meta.get(token);
    } catch {
      return null;
    }
  }

  /** Side-store вторичен относительно факта отзыва токена — его сбой проглатываем. */
  private async safeDeleteMeta(token: string): Promise<void> {
    try {
      await this.meta.delete(token);
    } catch {
      // токен уже удалён из стора — главное сделано; метаданные истекут по TTL
    }
  }

  /** Токен уже отозван к моменту аудита — недоступность audit-БД не должна давать 500. */
  private async safeAudit(record: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(record);
    } catch {
      // аудит отдельный от крит-пути отзова
    }
  }
}
