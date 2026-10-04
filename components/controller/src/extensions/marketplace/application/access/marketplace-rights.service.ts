import { Inject, Injectable } from '@nestjs/common';
import {
  MARKETPLACE_CART_REPOSITORY,
  type MarketplaceCartDomainRepository,
} from '../../domain/repositories/marketplace-cart.repository';
import type { IConfig } from '../../types';
import { MarketplaceOnboardingSource } from '../dto/marketplace-onboarding-state.dto';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import { MarketplaceOnboardingService } from '../onboarding/marketplace-onboarding.service';
import { MarketplaceExtensionConfigService } from '../services/marketplace-extension-config.service';
import { conditionsFor, rightsFor, type MarketplaceCondition } from './marketplace-access-matrix';

/** Исход проверки права: при отказе по условию — какое условие ждёт выполнения. */
export interface MarketplaceRightCheck {
  allowed: boolean;
  /** Право роли положено, но условие строки таблицы ещё не выполнено. */
  missing?: MarketplaceCondition;
}

/** Сколько помнить, что заказчик подключён: подпись и выбор участка назад не откатываются. */
const ONBOARDED_TTL_MS = 60_000;

/**
 * Права пайщика по таблице Стола заказов с учётом условий (C28-87).
 *
 * Единственное место, где условия таблицы сверяются с жизнью: его спрашивают
 * и серверный гард операции, и провайдер прав рабочего стола. Поэтому страница
 * видна ровно тогда, когда сервер выполнит её операции.
 */
@Injectable()
export class MarketplaceRightsService {
  private readonly onboardedUntil = new Map<string, number>();

  constructor(
    private readonly extensionConfig: MarketplaceExtensionConfigService,
    private readonly onboardingService: MarketplaceOnboardingService,
    @Inject(MARKETPLACE_CART_REPOSITORY)
    private readonly cartRepository: MarketplaceCartDomainRepository
  ) {}

  /** Условия кооператива: программа принята советом, хранение включено. */
  coopConditions(config: Partial<IConfig> | null | undefined): Set<MarketplaceCondition> {
    const held = new Set<MarketplaceCondition>();
    if (config?.coopAcceptance?.accepted) held.add('coop-accepted');
    if (config?.warehouse?.containers_enabled) held.add('containers-enabled');
    if (config?.warehouse?.cells_enabled) held.add('cells-enabled');
    return held;
  }

  /**
   * Заказчик подключён: оферта программы подписана и пункт выдачи выбран —
   * два независимых факта. Подпись могла быть дана ещё при вступлении, где
   * пункта выдачи не выбирают; а без подключённой программы подписывать
   * нечего, и «подписи не требуется» подписью не считается.
   */
  async isOrdererOnboarded(coopname: string, username: string): Promise<boolean> {
    const key = `${coopname}:${username}`;
    const until = this.onboardedUntil.get(key);
    if (until && until > Date.now()) return true;
    const [state, cart] = await Promise.all([
      this.onboardingService.getOnboardingState(username),
      this.cartRepository.findByOrderer(coopname, username),
    ]);
    const signed = state.source === MarketplaceOnboardingSource.AGREEMENT_SIGNED && !state.requires_gate;
    const onboarded = signed && Boolean(cart?.delivery_braname);
    if (onboarded) this.onboardedUntil.set(key, Date.now() + ONBOARDED_TTL_MS);
    return onboarded;
  }

  /** Все выполненные условия пайщика — для набора прав рабочего стола. */
  async heldConditions(
    coopname: string,
    username: string,
    roles: MarketplaceRole[],
    config?: Partial<IConfig> | null
  ): Promise<Set<MarketplaceCondition>> {
    const held = this.coopConditions(config === undefined ? await this.extensionConfig.get() : config);
    if (held.has('coop-accepted') && roles.includes('orderer') && (await this.isOrdererOnboarded(coopname, username))) {
      held.add('orderer-onboarded');
    }
    return held;
  }

  /** Права пайщика, действующие сейчас, в виде `Ресурс:действие`. */
  async rights(coopname: string, username: string, roles: MarketplaceRole[], config?: Partial<IConfig> | null): Promise<string[]> {
    return rightsFor(roles, await this.heldConditions(coopname, username, roles, config));
  }

  /**
   * Вправе ли пайщик на действие сейчас. Подключение заказчика читается
   * только тогда, когда без него право не складывается: поставщик, оператор
   * и председатель проходят по своим строкам без лишних запросов.
   */
  async check(
    coopname: string,
    username: string,
    roles: MarketplaceRole[],
    resource: string,
    action: string
  ): Promise<MarketplaceRightCheck> {
    const sets = conditionsFor(roles, resource, action);
    if (sets.length === 0) return { allowed: false };
    if (sets.some((set) => set.length === 0)) return { allowed: true };

    const held = this.coopConditions(await this.extensionConfig.get());
    const satisfied = () => sets.some((set) => set.every((condition) => held.has(condition)));
    if (satisfied()) return { allowed: true };

    const needsOnboarding = sets.some((set) => set.includes('orderer-onboarded'));
    if (needsOnboarding && held.has('coop-accepted') && (await this.isOrdererOnboarded(coopname, username))) {
      held.add('orderer-onboarded');
      if (satisfied()) return { allowed: true };
    }

    // Ближайшая к выполнению строка: та, где не хватает меньше всего условий.
    const missing = sets
      .map((set) => set.filter((condition) => !held.has(condition)))
      .sort((a, b) => a.length - b.length)[0];
    const order: MarketplaceCondition[] = ['coop-accepted', 'containers-enabled', 'cells-enabled', 'orderer-onboarded'];
    return { allowed: false, missing: order.find((condition) => missing.includes(condition)) };
  }
}
