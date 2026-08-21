import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  DESKTOP_GRANTS_FILTER_REGISTRY_PORT,
  REGISTRATION_OFFER_FILTER_REGISTRY_PORT,
  type IDesktopGrantsFilterHook,
  type IDesktopGrantsFilterRegistryPort,
  type InnerAgreementRegistration,
  type InnerDesktopGrantsContext,
  type InnerDesktopGrantsFilterTarget,
  type InnerProgramRegistration,
  type IRegistrationOfferFilterHook,
  type IRegistrationOfferFilterRegistryPort,
} from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EdubridgeConfigHolder } from '../config/edubridge-config.holder';
import { EDUBRIDGE_ROLE_FACTS_PORT, type IEdubridgeRoleFactsPort } from '../membership/edubridge-role-facts.port';

/**
 * Имя расширения «Благорост» в реестре платформы. Больше о нём ничего не
 * известно и знать не нужно: если «Благорост» не установлен — его столов и
 * программ в конвейерах нет, политика ничего не делает.
 */
const CAPITAL_EXTENSION_NAME = 'capital';

/**
 * Сосуществование с «Благоростом» (архитектура №88, сужающие политики).
 *
 * Образовательному кооперативу «Благорост» нужен ради преподавателей (взнос
 * результатами работы, право требования). Остальным пайщикам он мешает, а его
 * оферты при вступлении сбивают с толку. Поэтому:
 *  - столы «Благороста» остаются преподавателям и совету (председатель,
 *    члены совета — они «Благоростом» управляют); рядовым пайщикам — нет;
 *  - программы и оферты «Благороста» не предлагаются при вступлении — их
 *    подпишет тот, кто станет преподавателем, со своего стола.
 *
 * Всё — через конвейеры ядра и только сужением: ни своего интерфейса к
 * «Благоросту», ни правок в нём. Выключается настройкой «Связать с Благоростом».
 */
@Injectable()
export class EdubridgeCapitalNarrowingPolicy
  implements IDesktopGrantsFilterHook, IRegistrationOfferFilterHook, OnModuleInit, OnModuleDestroy
{
  readonly extensionName = EDUBRIDGE_EXTENSION_NAME;

  constructor(
    @Inject(DESKTOP_GRANTS_FILTER_REGISTRY_PORT) private readonly grantsFilters: IDesktopGrantsFilterRegistryPort,
    @Inject(REGISTRATION_OFFER_FILTER_REGISTRY_PORT) private readonly offerFilters: IRegistrationOfferFilterRegistryPort,
    @Inject(EDUBRIDGE_ROLE_FACTS_PORT) private readonly roleFacts: IEdubridgeRoleFactsPort,
    private readonly config: EdubridgeConfigHolder
  ) {}

  onModuleInit(): void {
    this.grantsFilters.register(this);
    this.offerFilters.register(this);
  }

  onModuleDestroy(): void {
    this.grantsFilters.unregister(this.extensionName);
    this.offerFilters.unregister(this.extensionName);
  }

  private get enabled(): boolean {
    return this.config.get().capital_integration;
  }

  async filterGrants(target: InnerDesktopGrantsFilterTarget, ctx: InnerDesktopGrantsContext): Promise<readonly string[]> {
    if (!this.enabled || target.extensionName !== CAPITAL_EXTENSION_NAME) return target.grants;
    if (ctx.userRole === 'chairman' || ctx.userRole === 'member') return target.grants;
    if (!ctx.username) return [];
    const facts = await this.roleFacts.resolve(ctx.coopname, ctx.username);
    return facts.isTeacher ? target.grants : [];
  }

  filterPrograms(programs: readonly InnerProgramRegistration[]): readonly string[] {
    return programs.filter((p) => this.enabled ? p.extension_name !== CAPITAL_EXTENSION_NAME : true).map((p) => p.key);
  }

  filterAgreements(agreements: readonly InnerAgreementRegistration[]): readonly string[] {
    return agreements.filter((a) => this.enabled ? a.extension_name !== CAPITAL_EXTENSION_NAME : true).map((a) => a.id);
  }
}
