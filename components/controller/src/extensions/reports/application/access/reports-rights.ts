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
export const REPORTS_DESKTOP_NAME = 'reports';

/**
 * Таблица прав Стола бухгалтера (C28-87): роль → право `Ресурс:действие`.
 * Отчётность, её реквизиты, календарь сдачи и удержанный налог ведёт председатель.
 */
export const reportsRightsTable: RightsTable<CouncilRole, never> = {
  council: [],
  chairman: [
    {
      when: [],
      rights: {
        Report: ['read', 'draft', 'generate'],
        ReportRequisites: ['read', 'manage'],
        ReportCalendar: ['read', 'manage'],
        WithheldTax: ['read', 'pay'],
      },
    },
  ],
};

/**
 * Описание прав Стола бухгалтера: по нему работают общий гард операций
 * расширения (`RightsGuard`) и права страниц рабочего стола.
 */
@Injectable()
export class ReportsRights implements AppRights<CouncilRole, never>, OnModuleInit {
  readonly extensionName = REPORTS_DESKTOP_NAME;
  readonly table = reportsRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<CouncilRole[]> {
    return councilRolesOf(caller.role);
  }
}
