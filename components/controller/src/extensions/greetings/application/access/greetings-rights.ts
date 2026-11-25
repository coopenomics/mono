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
 * Таблица прав приложения «Поздравления»: шаблоны, журнал и календарь видит и
 * ведёт только председатель. Члены совета приложение не видят (решение
 * владельца 25.11.2026); отдельной роли под поздравления нет.
 */
export const greetingsRightsTable: RightsTable<CouncilRole, never> = {
  // Совет прав не получает: таблица перечисляет все роли, пустой список — отказ.
  council: [],
  chairman: [{ when: [], rights: { Greetings: ['read', 'manage'] } }],
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
