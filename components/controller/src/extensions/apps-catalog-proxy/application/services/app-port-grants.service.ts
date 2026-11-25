import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { TableStore } from '@coopenomics/extension-kit';
import { APP_PORT_GRANT_STORE } from '../../infrastructure/database/apps-catalog-proxy-stores';
import { AppPortGrantRecord } from '../../infrastructure/records/app-port-grant.record';
import { REMOTE_PORT_NAMES } from './remote-ports.catalog';

/** Действие цепи в заявке: `контракт::действие` именами цепи. */
const CHAIN_ACTION = /^[a-z1-5.]{1,13}::[a-z1-5.]{1,13}$/;

/** Что приложение заявило в манифесте пакета (`coopenomics.ports`, `coopenomics.chainActions`). */
export interface AppPortDeclaration {
  ports: string[];
  chainActions: string[];
}

/** sha256 токена приложения: в базе лежит только он. */
export function hashAppToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Заявки приложений каталога на порты ядра (487-17).
 *
 * Установка приложения заводит заявку и получает токен; контейнер приложения
 * предъявляет токен в каждом вызове порта. Снятие приложения стирает заявку —
 * токен перестаёт работать сразу, ждать его истечения незачем. Повторная
 * выдача тому же пакету заменяет токен: прежний контейнер с прежним токеном
 * доступа к ядру лишается.
 */
@Injectable()
export class AppPortGrantsService {
  constructor(
    @Inject(APP_PORT_GRANT_STORE) private readonly store: TableStore<AppPortGrantRecord>,
  ) {}

  /**
   * Завести или заменить заявку пакета. Неизвестные порты и действия в
   * неверной записи отбрасываются: опечатка в манифесте не должна стать
   * доступом, который никто не проверял.
   *
   * @returns Токен приложения. Отдаётся один раз — в базе остаётся его хэш.
   */
  async issue(packageId: string, declared: AppPortDeclaration): Promise<{ token: string; ports: string[]; chainActions: string[] }> {
    const ports = [...new Set(declared.ports)].filter((p) => REMOTE_PORT_NAMES.has(p)).sort();
    const chainActions = [...new Set(declared.chainActions)].filter((a) => CHAIN_ACTION.test(a)).sort();
    const token = `apt_${randomBytes(32).toString('hex')}`;
    const now = new Date();
    const fields = { tokenHash: hashAppToken(token), ports, chainActions, updatedAt: now };
    if (await this.store.exists({ packageId })) await this.store.update({ packageId }, fields);
    else await this.store.insert({ packageId, ...fields, createdAt: now });
    return { token, ports, chainActions };
  }

  /** Стереть заявку пакета: его токен больше не принимается. */
  async revoke(packageId: string): Promise<void> {
    await this.store.delete({ packageId });
  }

  /** Заявка по токену приложения; `null` — токен неизвестен или отозван. */
  async byToken(token: string): Promise<AppPortGrantRecord | null> {
    if (!token.startsWith('apt_')) return null;
    return this.store.findOne({ tokenHash: hashAppToken(token) });
  }
}
