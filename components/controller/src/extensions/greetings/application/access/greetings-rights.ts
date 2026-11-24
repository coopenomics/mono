import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  councilRolesOf,
  desktopGrantsOf,
  type AppRights,
  type CouncilRole,
  type RightsCaller,
  type RightsTable,
} from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';

/** Имя рабочего стола приложения: под ним выдаются права страниц. */
export const GREETINGS_DESKTOP_NAME = 'greetings';

/**
 * Таблица прав приложения «Поздравления»: шаблоны, журнал и календарь читает
 * совет, шаблоны пишет и включает председатель. Отдельной роли под
 * поздравления нет (решение владельца 24.11.2026).
 */
export const greetingsRightsTable: RightsTable<CouncilRole, never> = {
  council: [{ when: [], rights: { Greetings: ['read'] } }],
  chairman: [{ when: [], rights: { Greetings: ['manage'] } }],
};

@Injectable()
export class GreetingsRights implements AppRights<CouncilRole, never>, OnModuleInit {
  readonly extensionName = GREETINGS_DESKTOP_NAME;
  readonly table = greetingsRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<CouncilRole[]> {
    return councilRolesOf(caller.role);
  }
}
