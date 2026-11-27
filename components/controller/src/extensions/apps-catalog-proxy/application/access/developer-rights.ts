import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { councilRolesOf, desktopGrantsOf, type AppRights, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';
import { AppsCatalogHttpService } from '../../infrastructure/apps-catalog-http.service';

/** Имя рабочего стола расширения: под ним выдаются права страниц. */
export const DEVELOPER_DESKTOP_NAME = 'developer';

/**
 * Председатель — администратор каталога кооператива, издатель — только свои
 * пакеты, оператор — председатель узла оператора каталога.
 */
export type DeveloperRole = 'chairman' | 'operator' | 'publisher';

/**
 * Таблица прав расширения «Стол разработчика» (C28-87): роль → право `Ресурс:действие`.
 *
 *  - `Developer:manage` — все пакеты, цены и издатели кооператива; «Стол
 *    администратора»;
 *  - `CatalogOperator:manage` — модерация выпусков и запись пакета в каталог.
 *    Право есть только на узле оператора каталога: модерацию ведёт оператор,
 *    и ключ оператора каталога держит только его узел (487-37, слово
 *    владельца 27.11.2026: «только у оператора должна быть страница
 *    модерации»). На узле кооператива страницы «Модерация» нет, операции
 *    модерации отвечают отказом в праве;
 *  - `Publisher:manage` — свои пакеты, их цены и ключи каталога; «Стол
 *    разработчика».
 *
 * Издателем становится любой принятый пайщик: он сам регистрирует пакет на
 * странице «Мои пакеты» (решение владельца 27.11.2026 — прежде издателя
 * назначал председатель, и без него пайщик не мог начать). Выпуск по-прежнему
 * проходит модерацию. Операции издателя сверяют назначение «аккаунт → пакет»
 * в сервисе: право открывает стол, назначение — конкретный пакет.
 */
export const developerRightsTable: RightsTable<DeveloperRole, never> = {
  chairman: [{ when: [], rights: { Developer: ['manage'] } }],
  operator: [{ when: [], rights: { CatalogOperator: ['manage'] } }],
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
    private readonly catalog: AppsCatalogHttpService,
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  roles(caller: RightsCaller): Promise<DeveloperRole[]> {
    const roles: DeveloperRole[] = councilRolesOf(caller.role).includes('chairman') ? ['chairman'] : [];
    // Оператор каталога — председатель узла, у которого есть ключ оператора.
    if (roles.length > 0 && this.catalog.hasOperatorAccess) roles.push('operator');
    if (caller.status === ACCEPTED_STATUS) roles.push('publisher');
    return Promise.resolve(roles);
  }
}
