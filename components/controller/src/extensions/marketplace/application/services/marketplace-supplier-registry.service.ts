import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MARKETPLACE_SUPPLIER_REPOSITORY,
  type MarketplaceSupplierDomainRepository,
} from '../../domain/repositories/marketplace-supplier.repository';
import {
  MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT,
  type MarketplaceNewSupplierRequestEvent,
} from '../events/marketplace-notification.events';
import type { MarketplaceSupplierDomainEntity } from '../../domain/entities/marketplace-supplier.entity';
import {
  MarketplaceSupplierModel,
  MarketplaceSupplierStatus,
} from '../../domain/entities/marketplace-supplier.types';

export const MARKETPLACE_SUPPLIER_REGISTRY_SERVICE = Symbol(
  'MARKETPLACE_SUPPLIER_REGISTRY_SERVICE'
);

interface IIsOffererCacheEntry {
  result: boolean;
  expires_at: number;
}

/**
 * Реестр поставщиков «Стола заказов» — источник `context.isOfferer` для
 * `mapCoreRolesToMarketplaceRoles` и состояние онбординга поставщика.
 *
 * Допуск к публикации поставок: запись со `status=APPROVED` ЛИБО сам
 * кооператив (`member === coopname`, перепоставка остатков FR5 — отдельной
 * записи не требует). Концепция whitelist (открытая витрина / по списку)
 * упразднена: больше нет режима «offerer для всех».
 *
 * `isOfferer` дёргается из `MarketplaceMembershipGuard` на каждый GraphQL-
 * запрос пайщика — кешируется in-memory с TTL, инвалидируется на любой записи.
 */
@Injectable()
export class MarketplaceSupplierRegistryService {
  private static readonly IS_OFFERER_CACHE_TTL_MS = 60_000;
  private readonly isOffererCache = new Map<string, IIsOffererCacheEntry>();

  constructor(
    @Inject(MARKETPLACE_SUPPLIER_REPOSITORY)
    private readonly repo: MarketplaceSupplierDomainRepository,
    private readonly eventBus: EventEmitter2
  ) {}

  async list(coopname: string): Promise<MarketplaceSupplierDomainEntity[]> {
    return this.repo.list(coopname);
  }

  async findByMember(
    coopname: string,
    member_account: string
  ): Promise<MarketplaceSupplierDomainEntity | null> {
    return this.repo.findByMember(coopname, member_account);
  }

  /**
   * Может ли пайщик публиковать поставки в текущем кооперативе. true для
   * самого кооператива (перепоставка остатков) и для одобренного поставщика.
   */
  async isOfferer(coopname: string, member_account: string): Promise<boolean> {
    if (member_account === coopname) return true;

    const cacheKey = `${coopname}::${member_account}`;
    const now = Date.now();
    const cached = this.isOffererCache.get(cacheKey);
    if (cached && cached.expires_at > now) return cached.result;

    const entry = await this.repo.findByMember(coopname, member_account);
    const result = entry !== null && entry.status === MarketplaceSupplierStatus.APPROVED;

    this.isOffererCache.set(cacheKey, {
      result,
      expires_at: now + MarketplaceSupplierRegistryService.IS_OFFERER_CACHE_TTL_MS,
    });
    return result;
  }

  /**
   * Заявка пайщика на допуск по членской модели (путь 1): создаёт запись
   * `PENDING` с реквизитами бумажного договора. Идемпотентна для уже поданной
   * заявки; отклонённую — переоткрывает с новыми реквизитами.
   */
  async requestMembership(
    coopname: string,
    member_account: string,
    contract_number: string,
    contract_date: string
  ): Promise<MarketplaceSupplierDomainEntity> {
    const existing = await this.repo.findByMember(coopname, member_account);
    if (existing) {
      if (existing.status === MarketplaceSupplierStatus.APPROVED) {
        throw new ConflictException('Вы уже допущены как поставщик.');
      }
      if (existing.status === MarketplaceSupplierStatus.PENDING) {
        return existing;
      }
      // REJECTED → переоткрываем заявку с новыми реквизитами договора.
      const reopened = await this.repo.patch(coopname, member_account, {
        model: MarketplaceSupplierModel.MEMBERSHIP,
        status: MarketplaceSupplierStatus.PENDING,
        contract_number,
        contract_date,
        reviewed_by: null,
        reviewed_at: null,
      });
      this.invalidateCache(coopname);
      this.emitNewRequest(coopname, member_account, contract_number);
      return reopened;
    }

    const created = await this.repo.create({
      coopname,
      member_account,
      model: MarketplaceSupplierModel.MEMBERSHIP,
      status: MarketplaceSupplierStatus.PENDING,
      contract_number,
      contract_date,
      requested_by: member_account,
      reviewed_by: null,
    });
    this.invalidateCache(coopname);
    this.emitNewRequest(coopname, member_account, contract_number);
    return created;
  }

  /**
   * Сигнал о новой заявке поставщика — listener шлёт председателю push на
   * рассмотрение. Эмитится после записи в PG (INV-12); доставка не влияет на
   * основной flow.
   */
  private emitNewRequest(
    coopname: string,
    member_account: string,
    contract_number: string
  ): void {
    const event: MarketplaceNewSupplierRequestEvent = {
      coopname,
      member_account,
      contract_number,
    };
    this.eventBus.emit(MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT, event);
  }

  /**
   * Прямое добавление поставщика администратором (путь 2): запись сразу
   * `APPROVED`, минуя ожидание. Upsert: повторное добавление обновляет
   * реквизиты и одобряет.
   */
  async addSupplier(
    coopname: string,
    member_account: string,
    model: MarketplaceSupplierModel,
    contract_number: string | null,
    contract_date: string | null,
    added_by: string
  ): Promise<MarketplaceSupplierDomainEntity> {
    const existing = await this.repo.findByMember(coopname, member_account);
    let result: MarketplaceSupplierDomainEntity;
    if (existing) {
      result = await this.repo.patch(coopname, member_account, {
        model,
        status: MarketplaceSupplierStatus.APPROVED,
        contract_number,
        contract_date,
        reviewed_by: added_by,
        reviewed_at: new Date(),
      });
    } else {
      result = await this.repo.create({
        coopname,
        member_account,
        model,
        status: MarketplaceSupplierStatus.APPROVED,
        contract_number,
        contract_date,
        requested_by: added_by,
        reviewed_by: added_by,
      });
    }
    this.invalidateCache(coopname);
    return result;
  }

  /** Одобрение заявки председателем (путь 1). */
  async approve(
    coopname: string,
    member_account: string,
    reviewed_by: string
  ): Promise<MarketplaceSupplierDomainEntity> {
    const result = await this.repo.patch(coopname, member_account, {
      status: MarketplaceSupplierStatus.APPROVED,
      reviewed_by,
      reviewed_at: new Date(),
    });
    this.invalidateCache(coopname);
    return result;
  }

  /** Отклонение заявки председателем. */
  async reject(
    coopname: string,
    member_account: string,
    reviewed_by: string
  ): Promise<MarketplaceSupplierDomainEntity> {
    const result = await this.repo.patch(coopname, member_account, {
      status: MarketplaceSupplierStatus.REJECTED,
      reviewed_by,
      reviewed_at: new Date(),
    });
    this.invalidateCache(coopname);
    return result;
  }

  /**
   * Смена модели работы поставщика — требует переподписания договора.
   * Членская: новый бумажный договор (номер + дата) → запись возвращается в
   * `PENDING` на повторное одобрение. Боевая модель пока не реализована.
   */
  async switchModel(
    coopname: string,
    member_account: string,
    model: MarketplaceSupplierModel,
    contract_number: string | null,
    contract_date: string | null
  ): Promise<MarketplaceSupplierDomainEntity> {
    if (model === MarketplaceSupplierModel.SHARE) {
      throw new ConflictException('Боевая модель работы поставщика пока недоступна.');
    }
    const result = await this.repo.patch(coopname, member_account, {
      model,
      status: MarketplaceSupplierStatus.PENDING,
      contract_number,
      contract_date,
      reviewed_by: null,
      reviewed_at: null,
    });
    this.invalidateCache(coopname);
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
