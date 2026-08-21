import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  DESKTOP_GRANTS_REGISTRY_PORT,
  type IDesktopGrantsHook,
  type IDesktopGrantsRegistryPort,
  type InnerDesktopGrantsContext,
} from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { expandGrantsForRoles } from '../access/edubridge-grants';
import { EdubridgeMembershipService } from '../membership/edubridge-membership.service';

/**
 * Канон авторизации столов: единственный источник «кто что видит» на столах
 * «Образовательного моста». Кладёт себя в реестр ядра сам — ядро расширение
 * не импортирует. Роли считает тот же сервис, что и guard резолверов.
 *
 * Гость получает право на каталог: приложение — витрина до вступления.
 * До принятия ЦПП советом у председателя только настройка расширения.
 */
@Injectable()
export class EdubridgeDesktopGrantsProvider implements IDesktopGrantsHook, OnModuleInit {
  readonly extensionName = EDUBRIDGE_EXTENSION_NAME;

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    private readonly membership: EdubridgeMembershipService
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(this);
  }

  async resolveGrants(ctx: InnerDesktopGrantsContext): Promise<string[]> {
    const m = await this.membership.resolve(ctx.coopname, {
      username: ctx.username,
      role: ctx.userRole,
      status: ctx.userStatus,
    });
    const grants = new Set(expandGrantsForRoles(m.roles));

    if (!m.onboarded) {
      if (m.coreRoles.includes('Chairman')) grants.add('Extension:configure');
      return [...grants];
    }

    if (m.username) {
      // Пайщик без подписанной оферты видит гейт-страницу соответствующего стола.
      if (!m.facts.isLearner) grants.add('Onboarding:learner');
      if (!m.facts.isTeacher) grants.add('Onboarding:teacher');
    }
    return [...grants];
  }
}
