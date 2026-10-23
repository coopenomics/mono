import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { councilRolesOf, desktopGrantsOf, type AppRights, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';
import { AppsPublishersService } from '../services/apps-publishers.service';

/** Имя рабочего стола расширения: под ним выдаются права страниц. */
export const DEVELOPER_DESKTOP_NAME = 'developer';

/** Председатель ведёт каталог кооператива, издатель — только свои пакеты. */
export type DeveloperRole = 'chairman' | 'publisher';

/**
 * Таблица прав расширения «Стол разработчика» (C28-87): роль → право `Ресурс:действие`.
 *
 *  - `Developer:manage` — пакеты, выпуски, модерация, подписка и назначение
 *    издателей; стол «Стол разработчика»;
 *  - `Publisher:manage` — свои пакеты и ключи каталога; стол «Мои приложения».
 *
 * Операции издателя дополнительно сверяют назначение «аккаунт → пакет» в
 * сервисе: право открывает стол, назначение — конкретный пакет.
 */
export const developerRightsTable: RightsTable<DeveloperRole, never> = {
  chairman: [{ when: [], rights: { Developer: ['manage'] } }],
  publisher: [{ when: [], rights: { Publisher: ['manage'] } }],
};

/** Принятый пайщик — по статусу учётной записи узла. */
const ACCEPTED_STATUS = 'active';

/**
 * Описание прав «Стола разработчика»: по нему работают гард операций
 * расширения и права страниц рабочего стола.
 */
@Injectable()
export class DeveloperRights implements AppRights<DeveloperRole, never>, OnModuleInit {
  readonly extensionName = DEVELOPER_DESKTOP_NAME;
  readonly table = developerRightsTable;

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    private readonly publishers: AppsPublishersService,
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<DeveloperRole[]> {
    const roles: DeveloperRole[] = councilRolesOf(caller.role).includes('chairman') ? ['chairman'] : [];
    if (caller.status === ACCEPTED_STATUS) {
      const assignments = await this.publishers.listFor(caller.username);
      if (assignments.length > 0) roles.push('publisher');
    }
    return roles;
  }
}
