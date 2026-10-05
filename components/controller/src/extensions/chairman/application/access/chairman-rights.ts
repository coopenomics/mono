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

/** Имя рабочего стола расширения: под ним выдаются права страниц. */
export const CHAIRMAN_DESKTOP_NAME = 'chairman';

/**
 * Таблица прав стола председателя (C28-87): роль → право `Ресурс:действие`.
 *
 * Одобрения читает совет, решение по одобрению принимает председатель; шаги
 * подключения кооператива ведёт председатель. Права ядра на этом же столе
 * (участки, приложения, настройки) выдаёт таблица ядра — стол получает оба набора.
 */
export const chairmanRightsTable: RightsTable<CouncilRole, never> = {
  council: [
    {
      when: [],
      rights: {
        Approval: ['read'],
      },
    },
  ],
  chairman: [
    {
      when: [],
      rights: {
        Approval: ['confirm'],
        ChairmanOnboarding: ['manage'],
      },
    },
  ],
};

/**
 * Описание прав стола председателя: по нему работают общий гард операций
 * расширения (`RightsGuard`) и права страниц рабочего стола.
 */
@Injectable()
export class ChairmanRights implements AppRights<CouncilRole, never>, OnModuleInit {
  readonly extensionName = CHAIRMAN_DESKTOP_NAME;
  readonly table = chairmanRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<CouncilRole[]> {
    return councilRolesOf(caller.role);
  }
}
