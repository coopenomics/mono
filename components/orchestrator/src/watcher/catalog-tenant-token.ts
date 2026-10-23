/**
 * @fileoverview Tenant JWT каталога, который оркестратору передаёт ядро
 * (Архитектура v5 каталога, 487-34).
 *
 * Ключ входа в каталог (`<coop>@catalog`) живёт в хранилище ядра, у
 * оркестратора его нет. Ядро выпускает им tenant JWT (30 минут) и раз в
 * 10 минут передаёт свежий: `PUT /v1/internal/catalog/tenant-token`. Токен
 * хранится только в памяти процесса; после перезапуска оркестратор ждёт
 * следующей передачи — ядро делает её и при своём старте.
 */
import { Body, Controller, HttpCode, Injectable, Put } from '@nestjs/common';

@Injectable()
export class CatalogTenantToken {
  private token: string | null = null;

  get(): string | null {
    return this.token;
  }

  set(token: string): void {
    this.token = token;
  }

  /** Токен для запроса; без токена запрос к каталогу не имеет смысла. */
  require(): string {
    if (this.token === null) {
      throw new Error('tenant JWT каталога ещё не получен от ядра');
    }
    return this.token;
  }
}

@Controller('v1/internal/catalog')
export class CatalogTenantTokenController {
  constructor(private readonly store: CatalogTenantToken) {}

  @Put('tenant-token')
  @HttpCode(204)
  receive(@Body() body: { token?: unknown }): void {
    if (typeof body?.token !== 'string' || body.token.length === 0) return;
    this.store.set(body.token);
  }
}
