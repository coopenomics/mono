import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  desktopGrantsOf,
  memberRolesOf,
  type AppRights,
  type MemberRole,
  type RightsCaller,
  type RightsTable,
} from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';

/** Имя рабочего стола расширения: под ним выдаются права страниц. */
export const KU_DESKTOP_NAME = 'trustee';

/**
 * Права пайщика на столе кооперативного участка: собрания участка, заявки в
 * доверенные, документы участка на своё имя. Кто в собрании председатель или
 * инициатор и кто председатель участка — сверяет сервис участка по записи
 * собрания и по участку в цепи.
 */
const MEMBER_RIGHTS = {
  KuDecision: ['read', 'create', 'join', 'vote', 'conduct', 'cancel'],
  KuTrust: ['read', 'request', 'decide'],
  KuDocument: ['generate:own'],
};

/**
 * Таблица прав кооперативного участка (C28-87): роль → право `Ресурс:действие`.
 * Совет собирает документы участка на имя любого пайщика; он проходит по роли
 * в любом статусе учётной записи, поэтому права пайщика названы в его строке повторно.
 */
export const kuRightsTable: RightsTable<MemberRole, never> = {
  participant: [{ when: [], rights: MEMBER_RIGHTS }],
  council: [{ when: [], rights: { ...MEMBER_RIGHTS, KuDocument: ['generate:own', 'generate:all'] } }],
  chairman: [],
};

/**
 * Описание прав кооперативного участка: по нему работают общий гард операций
 * расширения (`RightsGuard`) и права страниц рабочего стола.
 */
@Injectable()
export class KuRights implements AppRights<MemberRole, never>, OnModuleInit {
  readonly extensionName = KU_DESKTOP_NAME;
  readonly table = kuRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<MemberRole[]> {
    return memberRolesOf(caller);
  }
}
