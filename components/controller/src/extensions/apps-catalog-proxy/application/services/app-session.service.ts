import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '@coopenomics/extension-kit';
import type { InnerAccessIdentity } from '@coopenomics/innercoop';
import { AppPortGrantsService } from './app-port-grants.service';

/** Признак токена приложения: по нему ядро отличает его от токена пайщика. */
export const APP_SESSION_PREFIX = 'aps_';

/** Срок токена приложения, секунд: стол запрашивает новый по истечении. */
const APP_SESSION_TTL_SEC = 600;

interface AppSessionPayload {
  /** Пакет, для бэкенда которого токен выдан. */
  pkg: string;
  /** Пайщик. */
  sub: string;
  /** Роль пайщика в кооперативе на момент выдачи. */
  rl: string;
  /** Состояние учётной записи пайщика на момент выдачи. */
  st: string;
  /** Срок действия, секунды Unix. */
  exp: number;
}

/**
 * Токен пайщика для одного приложения каталога (487-18, изолированный фронт).
 *
 * Фронт приложения работает в изолированной рамке стола и токена пайщика не
 * получает: с ним приложение вызвало бы любое действие ядра от имени пайщика.
 * Стол просит у ядра токен приложения и сам подставляет его в запросы рамки к
 * бэкенду приложения. Бэкенд опознаёт пайщика портом `accessToken.identify`;
 * ядро принимает токен только от приложения, которому он выдан.
 *
 * Границы:
 *  - токен — не JWT и подписан отдельным ключом: гарды ядра его отвергают, ни
 *    один запрос ядра от имени пайщика им не выполнить;
 *  - токен одного приложения другое приложение не опознаёт;
 *  - выдаётся только для установленного приложения с заявленным портом
 *    `accessToken`.
 */
@Injectable()
export class AppSessionService {
  constructor(
    private readonly config: ConfigService,
    private readonly grants: AppPortGrantsService,
  ) {}

  /**
   * Выдать токен приложения вошедшему пайщику.
   *
   * @throws DomainError `APPS_CATALOG_PROXY_APP_SESSION_UNAVAILABLE` — приложение
   *   не установлено либо не заявляло порт `accessToken`.
   */
  async issue(packageId: string, identity: InnerAccessIdentity): Promise<{ token: string; expiresAt: string }> {
    const grant = await this.grants.byPackage(packageId);
    if (grant === null || !grant.ports.includes('accessToken')) {
      throw DomainError.notFound('APPS_CATALOG_PROXY_APP_SESSION_UNAVAILABLE', { package_id: packageId });
    }
    const exp = Math.floor(Date.now() / 1000) + APP_SESSION_TTL_SEC;
    const payload: AppSessionPayload = { pkg: packageId, sub: identity.username, rl: identity.role, st: identity.status, exp };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return { token: `${APP_SESSION_PREFIX}${body}.${this.sign(body)}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  /** Токен приложения? Срабатывает и на значение с префиксом `Bearer`. */
  static isAppSession(token: unknown): token is string {
    return typeof token === 'string' && token.replace(/^Bearer\s+/i, '').startsWith(APP_SESSION_PREFIX);
  }

  /**
   * Опознать пайщика по токену приложения. `null` — подпись неверна, срок
   * истёк либо токен выдан другому приложению.
   */
  verify(token: string, packageId: string): InnerAccessIdentity | null {
    const payload = this.decode(token);
    if (payload === null || payload.pkg !== packageId) return null;
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    return { username: payload.sub, role: String(payload.rl ?? ''), status: String(payload.st ?? '') };
  }

  /** Тело токена с верной подписью; `null` — формат или подпись неверны. */
  private decode(token: string): AppSessionPayload | null {
    const raw = token.replace(/^Bearer\s+/i, '').slice(APP_SESSION_PREFIX.length);
    const dot = raw.lastIndexOf('.');
    if (dot <= 0) return null;
    const body = raw.slice(0, dot);
    const given = Buffer.from(raw.slice(dot + 1));
    const expected = Buffer.from(this.sign(body));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AppSessionPayload;
    } catch {
      return null;
    }
  }

  /** Подпись тела токена ключом, производным от секрета узла. */
  private sign(body: string): string {
    const secret = this.config.get<string>('SERVER_SECRET');
    if (!secret) throw DomainError.internal('APPS_CATALOG_PROXY_APP_SESSION_NO_SECRET');
    const key = createHash('sha256').update(`${secret}:app-session`).digest();
    return createHmac('sha256', key).update(body).digest('base64url');
  }
}
