import { Injectable } from '@nestjs/common';
import config from '~/config/config';
import { IAuthentikAdminPort } from '~/domain/auth-v2/ports/authentik-admin.port';

/**
 * Admin-API адаптер authentik (Эпик 11): provisioning учётки + set_password.
 * Аутентификация — admin-токеном (`config.authV2.authentikAdminToken`,
 * `Authorization: Bearer`). Пароль передаётся прозрачно и НЕ логируется.
 *
 * Эндпоинты authentik:
 * - GET  /api/v3/core/users/?username=<u>          — поиск по точному username
 * - POST /api/v3/core/users/                       — создание учётки (internal)
 * - POST /api/v3/core/users/<pk>/set_password/     — установка пароля (204)
 */
@Injectable()
export class AuthentikAdminAdapter implements IAuthentikAdminPort {
  private get baseUrl(): string {
    return config.authV2.authentikInternalUrl;
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    const token = config.authV2.authentikAdminToken;
    if (!token)
      throw new Error('AUTHENTIK_ADMIN_TOKEN не сконфигурирован — запись в authentik невозможна');
    return { authorization: `Bearer ${token}`, accept: 'application/json', ...extra };
  }

  async findUserPk(username: string): Promise<number | null> {
    const url = `${this.baseUrl}/api/v3/core/users/?username=${encodeURIComponent(username)}`;
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`authentik users-list вернул ${res.status}`);
    const data = (await res.json()) as { results?: Array<{ pk: number; username: string }> };
    // ?username= в authentik — частичный фильтр; берём точное совпадение.
    const exact = data.results?.find((u) => u.username === username);
    return exact?.pk ?? null;
  }

  async ensureUser(params: { username: string; email: string; name?: string }): Promise<number> {
    const existing = await this.findUserPk(params.username);
    if (existing !== null) return existing;

    const res = await fetch(`${this.baseUrl}/api/v3/core/users/`, {
      method: 'POST',
      headers: this.authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        username: params.username,
        email: params.email,
        name: params.name ?? params.username,
        type: 'internal',
        path: 'users',
        is_active: true,
      }),
    });
    if (!res.ok) throw new Error(`authentik create-user вернул ${res.status}`);
    const data = (await res.json()) as { pk: number };
    return data.pk;
  }

  async setPassword(userPk: number, newPassword: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v3/core/users/${userPk}/set_password/`, {
      method: 'POST',
      headers: this.authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) throw new Error(`authentik set_password вернул ${res.status}`);
  }
}
