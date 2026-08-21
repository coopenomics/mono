import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  DESKTOP_GRANTS_REGISTRY_PORT,
  MonoAccountStatus,
  type IDesktopGrantsHook,
  type IDesktopGrantsRegistryPort,
  type InnerDesktopGrantsContext,
} from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { expandGrantsForRoles } from '../access/edubridge-grants';
import { mapUserRoleToCoreRoles } from '../membership/core-roles.mapper';
import { mapCoreRolesToEdubridgeRoles } from '../membership/edubridge-roles.mapper';
import { EDUBRIDGE_ROLE_FACTS_PORT, type IEdubridgeRoleFactsPort } from '../membership/edubridge-role-facts.port';

/**
 * Канон авторизации столов: единственный источник «кто что видит» на столах
 * «Образовательного моста». Кладёт себя в реестр ядра сам — ядро расширение
 * не импортирует.
 *
 * Гость получает право на каталог: приложение — витрина до вступления.
 * До принятия ЦПП советом у председателя только настройка расширения.
 */
@Injectable()
export class EdubridgeDesktopGrantsProvider implements IDesktopGrantsHook, OnModuleInit {
  readonly extensionName = EDUBRIDGE_EXTENSION_NAME;

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    @Inject(EDUBRIDGE_ROLE_FACTS_PORT) private readonly roleFacts: IEdubridgeRoleFactsPort
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(this);
  }

  async resolveGrants(ctx: InnerDesktopGrantsContext): Promise<string[]> {
    const guest = expandGrantsForRoles(['guest']);
    if (!ctx.username || ctx.userStatus !== MonoAccountStatus.Active) return guest;

    const coreRoles = mapUserRoleToCoreRoles(ctx.userRole);
    if (coreRoles.length === 0) return guest;

    const onboarded = Boolean(ctx.config?.coopAcceptance?.accepted);
    if (!onboarded) {
      return coreRoles.includes('Chairman') ? [...guest, 'Extension:configure'] : guest;
    }

    const facts = await this.roleFacts.resolve(ctx.coopname, ctx.username);
    const roles = mapCoreRolesToEdubridgeRoles(coreRoles, facts);
    const grants = new Set(expandGrantsForRoles(roles));

    // Пайщик без подписанной оферты видит гейт-страницу соответствующего стола.
    if (!facts.isLearner) grants.add('Onboarding:learner');
    if (!facts.isTeacher) grants.add('Onboarding:teacher');

    return [...grants];
  }
}
