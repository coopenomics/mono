import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MARKETPLACE_WHITELIST_REPOSITORY,
  type MarketplaceWhitelistDomainRepository,
} from '../../domain/repositories/marketplace-whitelist.repository';
import type { MarketplaceWhitelistEntryDomainEntity } from '../../domain/entities/marketplace-whitelist-entry.entity';

export const MARKETPLACE_WHITELIST_SERVICE = Symbol('MARKETPLACE_WHITELIST_SERVICE');

interface IIsOffererCacheEntry {
  result: boolean;
  expires_at: number;
}

/**
 * Story 3.1: управление whitelist пайщиков-поставщиков + источник
 * `context.isOfferer` для `mapCoreRolesToMarketplaceRoles` (Story 1.6).
 *
 * Семантика:
 *   - `auto-coop` запись неудаляема (FR5 — перепоставка остатков самим
 *     коопом);
 *   - если whitelist содержит только `auto-coop` → «открытая витрина»,
 *     `isOfferer` = true для всех `User`;
 *   - если есть хотя бы одна `manual` запись → «по whitelist»,
 *     `isOfferer` = true только для записанных.
 *
 * `isOfferer` дёргается из `MarketplaceMembershipGuard` на каждый GraphQL-
 * запрос пайщика — кешируется in-memory с TTL `IS_OFFERER_CACHE_TTL_MS`
 * (по умолчанию 60 сек), чтобы не превратить guard в N запросов/секунду.
 * Инвалидируется явно в `addToWhitelist` / `removeFromWhitelist`.
 */
@Injectable()
export class MarketplaceWhitelistService {
  private static readonly IS_OFFERER_CACHE_TTL_MS = 60_000;
  private readonly isOffererCache = new Map<string, IIsOffererCacheEntry>();

  constructor(
    @Inject(MARKETPLACE_WHITELIST_REPOSITORY)
    private readonly repo: MarketplaceWhitelistDomainRepository
  ) {}

  async list(coopname: string): Promise<MarketplaceWhitelistEntryDomainEntity[]> {
    return this.repo.list(coopname);
  }

  async addToWhitelist(
    coopname: string,
    member_account: string,
    added_by: string
  ): Promise<MarketplaceWhitelistEntryDomainEntity> {
    const entry = await this.repo.add(coopname, member_account, 'manual', added_by);
    this.invalidateCache(coopname);
    return entry;
  }

  async removeFromWhitelist(coopname: string, member_account: string): Promise<void> {
    const existing = await this.repo.findByMember(coopname, member_account);
    if (!existing) {
      throw new NotFoundException(
        `Пайщик ${member_account} не найден в списке поставщиков.`
      );
    }
    if (existing.role === 'auto-coop') {
      throw new ForbiddenException(
        'Запись о самом кооперативе нельзя удалить — она нужна для перепоставки остатков от лица кооператива.'
      );
    }
    await this.repo.remove(coopname, member_account);
    this.invalidateCache(coopname);
  }

  /**
   * Источник `context.isOfferer` для marketplace-roles.mapper. Возвращает
   * true, если пайщик может публиковать оферы в текущей конфигурации
   * витрины (см. семантику в JSDoc класса).
   */
  async isOfferer(coopname: string, member_account: string): Promise<boolean> {
    const cacheKey = `${coopname}::${member_account}`;
    const now = Date.now();
    const cached = this.isOffererCache.get(cacheKey);
    if (cached && cached.expires_at > now) return cached.result;

    const manualCount = await this.repo.countManual(coopname);
    let result: boolean;
    if (manualCount === 0) {
      result = true;
    } else {
      const entry = await this.repo.findByMember(coopname, member_account);
      result = entry !== null && entry.role === 'manual';
    }

    this.isOffererCache.set(cacheKey, {
      result,
      expires_at: now + MarketplaceWhitelistService.IS_OFFERER_CACHE_TTL_MS,
    });
    return result;
  }

  private invalidateCache(coopname: string): void {
    for (const key of Array.from(this.isOffererCache.keys())) {
      if (key.startsWith(`${coopname}::`)) {
        this.isOffererCache.delete(key);
      }
    }
  }
}
