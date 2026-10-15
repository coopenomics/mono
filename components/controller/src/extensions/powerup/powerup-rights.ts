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

/**
 * Таблица прав стола вычислительных ресурсов (C28-87): состояние и журнал
 * читает совет, настройки ведёт председатель. Своих операций у расширения
 * нет — таблица выдаёт права страниц рабочего стола.
 */
export const powerupRightsTable: RightsTable<CouncilRole, never> = {
  council: [{ when: [], rights: { Powerup: ['read'] } }],
  chairman: [{ when: [], rights: { Powerup: ['manage'] } }],
};

@Injectable()
export class PowerupRights implements AppRights<CouncilRole, never>, OnModuleInit {
  readonly extensionName = 'powerup';
  readonly table = powerupRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<CouncilRole[]> {
    return councilRolesOf(caller.role);
  }
}
