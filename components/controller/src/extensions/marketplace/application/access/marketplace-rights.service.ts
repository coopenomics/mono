import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  desktopGrantsOf,
  platformSettings,
  type AppRights,
  type RightFacts,
  type RightsCaller,
} from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, MonoAccountStatus, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';
import {
  MARKETPLACE_CART_REPOSITORY,
  type MarketplaceCartDomainRepository,
} from '../../domain/repositories/marketplace-cart.repository';
import type { IConfig } from '../../types';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceOnboardingSource } from '../dto/marketplace-onboarding-state.dto';
import { mapUserRoleToCoreRoles } from '../membership/core-roles.mapper';
import { mapCoreRolesToMarketplaceRoles, type MarketplaceRole } from '../membership/marketplace-roles.mapper';
import { MarketplaceOnboardingService } from '../onboarding/marketplace-onboarding.service';
import { MarketplaceExtensionConfigService } from '../services/marketplace-extension-config.service';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import {
  MARKETPLACE_SUPPLIER_REGISTRY_SERVICE,
  type MarketplaceSupplierRegistryService,
} from '../services/marketplace-supplier-registry.service';
import { marketplaceRightScopes, marketplaceRightsTable, type MarketplaceCondition } from './marketplace-access-matrix';
import { MarketplaceRightSubjects } from './marketplace-right-subjects.service';

/** Сколько помнить, что заказчик подключён: подпись и выбор участка назад не откатываются. */
const ONBOARDED_TTL_MS = 60_000;

/**
 * Описание прав Стола заказов (C28-87): таблица, роли пайщика, условия строк
 * и справочник объектов.
 *
 * Единственное место, где таблица сверяется с жизнью: по нему работают и
 * общий гард операций (`RightsGuard`), и права страниц рабочего стола. Поэтому
 * страница видна ровно тогда, когда сервер выполнит её операции.
 */
@Injectable()
export class MarketplaceRightsService implements AppRights<MarketplaceRole, MarketplaceCondition>, OnModuleInit {
  readonly extensionName = 'market';
  readonly table = marketplaceRightsTable;
  readonly impliedScopes = marketplaceRightScopes;
  /** Порядок ключей — порядок, в котором условие называется пайщику. */
  readonly conditionDenials: Record<MarketplaceCondition, string> = {
    'coop-accepted': 'MARKETPLACE_COOP_NOT_CONNECTED',
    'containers-enabled': 'MARKETPLACE_CONTAINERS_DISABLED',
    'cells-enabled': 'MARKETPLACE_STORAGE_CELLS_DISABLED',
    'orderer-onboarded': 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED',
  };
  /** Подключение заказчика читается с участием цепи — только когда без него право не складывается. */
  readonly lazyConditions: MarketplaceCondition[] = ['orderer-onboarded'];

  private readonly onboardedUntil = new Map<string, number>();

  constructor(
    private readonly extensionConfig: MarketplaceExtensionConfigService,
    private readonly onboardingService: MarketplaceOnboardingService,
    @Inject(MARKETPLACE_CART_REPOSITORY)
    private readonly cartRepository: MarketplaceCartDomainRepository,
    @Inject(MARKETPLACE_SUPPLIER_REGISTRY_SERVICE)
    private readonly supplierRegistry: MarketplaceSupplierRegistryService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly subjects: MarketplaceRightSubjects,
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT)
    private readonly grantsRegistry: IDesktopGrantsRegistryPort
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  /**
   * Роли пайщика на Столе заказов. В запросе к операции их уже посчитал гард
   * членства; для прав стола считаются здесь по тем же правилам.
   */
  async roles(caller: RightsCaller, request?: unknown): Promise<MarketplaceRole[]> {
    const member = (request as { currentMember?: IMarketplaceCurrentMember } | undefined)?.currentMember;
    if (member) return member.marketplace_roles as MarketplaceRole[];
    const coreRoles = mapUserRoleToCoreRoles(caller.role ?? undefined);
    if (coreRoles.length === 0) return [];
    // Совет проходит по роли в любом статусе — как в гарде членства и в ядре.
    if (!coreRoles.includes('Member') && caller.status !== MonoAccountStatus.Active) return [];
    const coopname = platformSettings().coopname;
    const [isOfferer, isKuChairman] = await Promise.all([
      this.supplierRegistry.isOfferer(coopname, caller.username),
      this.kuChairmanService.isKuChairman(coopname, caller.username),
    ]);
    return mapCoreRolesToMarketplaceRoles(coreRoles, { isOfferer, isKuChairman });
  }

  /**
   * Какие из условий `wanted` выполнены. Подключение заказчика читается, когда
   * программа принята: каркас спрашивает его отдельно, только если остальные
   * условия строки уже выполнены.
   */
  async conditions(
    caller: RightsCaller,
    roles: MarketplaceRole[],
    wanted: readonly MarketplaceCondition[],
    config?: unknown
  ): Promise<ReadonlySet<MarketplaceCondition>> {
    const held = new Set<MarketplaceCondition>();
    const wantsCoop = wanted.some((condition) => condition !== 'orderer-onboarded');
    if (wantsCoop) {
      const resolved = config === undefined ? await this.extensionConfig.get() : (config as Partial<IConfig> | null);
      for (const condition of this.coopConditions(resolved)) held.add(condition);
    }
    const accepted = wantsCoop ? held.has('coop-accepted') : true;
    if (wanted.includes('orderer-onboarded') && accepted && roles.includes('orderer')) {
      if (await this.isOrdererOnboarded(platformSettings().coopname, caller.username)) held.add('orderer-onboarded');
    }
    return held;
  }

  locate(kind: string, ids: string[]): Promise<RightFacts[]> {
    return this.subjects.locate(platformSettings().coopname, kind, ids);
  }

  kus(username: string): Promise<string[]> {
    return this.kuChairmanService.listBranamesForMember(platformSettings().coopname, username);
  }

  chairedKus(username: string): Promise<string[]> {
    return this.kuChairmanService.listChairedBranames(platformSettings().coopname, username);
  }

  /**
   * Метки подключения для страниц стола: что пайщику осталось сделать, чтобы
   * права его ролей начали действовать.
   */
  extraGrants(caller: RightsCaller, roles: MarketplaceRole[], held: ReadonlySet<MarketplaceCondition>): string[] {
    if (!held.has('coop-accepted')) {
      return mapUserRoleToCoreRoles(caller.role ?? undefined).includes('Chairman') ? ['Onboarding:coop'] : [];
    }
    const marks: string[] = [];
    if (roles.includes('orderer') && !held.has('orderer-onboarded')) marks.push('Onboarding:orderer');
    if (!roles.includes('offerer')) marks.push('Onboarding:offerer');
    return marks;
  }

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
    let state: Awaited<ReturnType<MarketplaceOnboardingService['getOnboardingState']>>;
    let cart: Awaited<ReturnType<MarketplaceCartDomainRepository['findByOrderer']>>;
    try {
      [state, cart] = await Promise.all([
        this.onboardingService.getOnboardingState(username),
        this.cartRepository.findByOrderer(coopname, username),
      ]);
    } catch (error) {
      // Состояние оферты читается с участием цепи. Пока цепь недоступна,
      // пайщик, которого узел уже видел подключённым, остаётся подключённым:
      // чтение своих заказов и корзины от связи с цепью зависеть не должно.
      if (until) return true;
      throw error;
    }
    if (until && state.source === MarketplaceOnboardingSource.NOT_CONFIGURED) return true;
    const signed = state.source === MarketplaceOnboardingSource.AGREEMENT_SIGNED && !state.requires_gate;
    const onboarded = signed && Boolean(cart?.delivery_braname);
    if (onboarded) this.onboardedUntil.set(key, Date.now() + ONBOARDED_TTL_MS);
    return onboarded;
  }
}
