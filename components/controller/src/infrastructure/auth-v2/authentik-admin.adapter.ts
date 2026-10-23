import { Injectable } from '@nestjs/common';
import config from '~/config/config';
import { IAuthentikAdminPort } from '~/domain/auth-v2/ports/authentik-admin.port';
import { DomainError } from '@coopenomics/extension-kit';

/**
 * Admin-API адаптер authentik (Эпик 11): provisioning учётки + set_password.
 * Аутентификация — admin-токеном (`config.authV2.authentikAdminToken`,
 * `Authorization: Bearer`). Пароль передаётся прозрачно и НЕ логируется.
 *
 * Эндпоинты authentik:
 * - GET  /api/v3/core/users/?username=<u>          — поиск по точному username
 * - POST /api/v3/core/users/                       — создание учётки (internal)
 * - POST /api/v3/core/users/<pk>/set_password/     — установка пароля (204)
 * - GET  /api/v3/core/users/?email=<e>             — поиск по почте
 * - PATCH /api/v3/core/users/<pk>/                 — смена почты
 */
@Injectable()
export class AuthentikAdminAdapter implements IAuthentikAdminPort {
  private get baseUrl(): string {
    return config.authV2.authentikInternalUrl;
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    const token = config.authV2.authentikAdminToken;
    if (!token)
      // i18n-ignore: отсутствует конфигурация AUTHENTIK_ADMIN_TOKEN — ошибка окружения, до пайщика не доходит
      throw new Error('AUTHENTIK_ADMIN_TOKEN не сконфигурирован — запись в authentik невозможна');
    return { authorization: `Bearer ${token}`, accept: 'application/json', ...extra };
  }

  async findUserPk(username: string): Promise<number | null> {
    return (await this.findUser(username))?.pk ?? null;
  }

  /** Учётка по точному username: pk и почта. */
  private async findUser(username: string): Promise<{ pk: number; email: string } | null> {
    const url = `${this.baseUrl}/api/v3/core/users/?username=${encodeURIComponent(username)}`;
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw DomainError.internal('AUTH_V2_AUTHENTIK_USERS_LIST_FAILED', { status: res.status });
    const data = (await res.json()) as { results?: Array<{ pk: number; username: string; email?: string }> };
    // ?username= в authentik — частичный фильтр; берём точное совпадение.
    const exact = data.results?.find((u) => u.username === username);
    return exact ? { pk: exact.pk, email: exact.email ?? '' } : null;
  }

  private async patchEmail(pk: number, email: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v3/core/users/${pk}/`, {
      method: 'PATCH',
      headers: this.authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw DomainError.internal('AUTH_V2_AUTHENTIK_UPDATE_USER_FAILED', { status: res.status });
  }

  async findUsernameByUuid(uuid: string): Promise<string | null> {
    const url = `${this.baseUrl}/api/v3/core/users/?uuid=${encodeURIComponent(uuid)}`;
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw DomainError.internal('AUTH_V2_AUTHENTIK_USERS_LIST_FAILED', { status: res.status });
    const data = (await res.json()) as { results?: Array<{ uuid: string; username: string }> };
    const exact = data.results?.find((u) => u.uuid === uuid);
    return exact?.username ?? null;
  }

  async findUsernamesByEmail(email: string): Promise<string[]> {
    const wanted = email.trim().toLowerCase();
    const url = `${this.baseUrl}/api/v3/core/users/?email=${encodeURIComponent(wanted)}`;
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw DomainError.internal('AUTH_V2_AUTHENTIK_USERS_LIST_FAILED', { status: res.status });
    const data = (await res.json()) as { results?: Array<{ username: string; email?: string }> };
    return (data.results ?? []).filter((u) => (u.email ?? '').trim().toLowerCase() === wanted).map((u) => u.username);
  }

  async updateEmail(username: string, email: string): Promise<boolean> {
    const user = await this.findUser(username);
    if (!user) return false;
    if (user.email.trim().toLowerCase() !== email.trim().toLowerCase()) await this.patchEmail(user.pk, email);
    return true;
  }

  async ensureUser(params: { username: string; email: string; name?: string }): Promise<number> {
    const existing = await this.findUser(params.username);
    if (existing) {
      // Почта учётки следует за почтой пайщика: прежде она ставилась только при
      // создании, и сменённая в реестре почта оставалась в authentik старой.
      if (existing.email.trim().toLowerCase() !== params.email.trim().toLowerCase()) {
        await this.patchEmail(existing.pk, params.email);
      }
      return existing.pk;
    }
    // Почта занята другой учёткой — не заводим вторую: вход по почте впустил бы
    // в первую найденную.
    const holders = (await this.findUsernamesByEmail(params.email)).filter((u) => u !== params.username);
    if (holders.length > 0) throw DomainError.badRequest('USER_EMAIL_TAKEN');

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
    if (!res.ok) throw DomainError.internal('AUTH_V2_AUTHENTIK_CREATE_USER_FAILED', { status: res.status });
    const data = (await res.json()) as { pk: number };
    return data.pk;
  }

  async setPassword(userPk: number, newPassword: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v3/core/users/${userPk}/set_password/`, {
      method: 'POST',
      headers: this.authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) throw DomainError.internal('AUTH_V2_AUTHENTIK_SET_PASSWORD_FAILED', { status: res.status });
  }
}
