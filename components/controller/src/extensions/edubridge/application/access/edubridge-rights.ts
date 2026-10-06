import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  platformSettings,
  type AppRights,
  type DesktopGrantsRequest,
  type RightsCaller,
  type RightsTable,
} from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort, type MonoAccountStatus } from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EdubridgeMembershipService, type IEdubridgeMembership } from '../membership/edubridge-membership.service';
import type { EdubridgeRole } from '../membership/edubridge-roles.mapper';
import { edubridgeAccessMatrix } from './edubridge-access-matrix';
import { expandGrantsForRoles } from './edubridge-grants';

/** Ключ запроса, под которым гард кладёт членство для `@CurrentEduMember`. */
export const EDUBRIDGE_MEMBERSHIP_KEY = 'edubridgeMembership';

/** Код отказа «права нет» — свой, на него опираются внешние тесты образования. */
export const EDUBRIDGE_NO_RIGHT = 'EDUBRIDGE_INSUFFICIENT_RIGHTS';

/**
 * Таблица прав «Образовательного моста» (C28-87) — та же матрица
 * `edubridgeAccessMatrix`, строка за строкой: роль → право `Ресурс:действие`.
 * Условий у строк нет: кто учащийся, преподаватель, администратор или
 * владелец, решает членство (`EdubridgeMembershipService`).
 */
export const edubridgeRightsTable: RightsTable<EdubridgeRole, never> = Object.fromEntries(
  Object.entries(edubridgeAccessMatrix).map(([role, rights]) => [role, [{ when: [], rights }]])
) as RightsTable<EdubridgeRole, never>;

/**
 * Описание прав образования для общего гарда операций (`RightsGuard`) и прав
 * страниц рабочего стола. Каталог открыт гостю, поэтому у таблицы названы роли
 * гостя. Членство считается один раз на запрос и кладётся в запрос — его
 * читает `@CurrentEduMember`, в том числе у операций без требования права.
 */
@Injectable()
export class EdubridgeRights implements AppRights<EdubridgeRole, never>, OnModuleInit {
  readonly extensionName = EDUBRIDGE_EXTENSION_NAME;
  readonly table = edubridgeRightsTable;
  readonly guestRoles: readonly EdubridgeRole[] = ['guest'];
  readonly noRightDenial = EDUBRIDGE_NO_RIGHT;

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    private readonly membership: EdubridgeMembershipService
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register({ extensionName: this.extensionName, resolveGrants: (ctx) => this.resolveGrants(ctx) });
  }

  /** Членство вошедшего (или гостя) на этот запрос: считается один раз. */
  async onRequest(caller: RightsCaller | null, request: unknown): Promise<void> {
    const req = request as Record<string, unknown> | undefined;
    if (!req) return;
    req[EDUBRIDGE_MEMBERSHIP_KEY] = await this.membershipOf(caller);
  }

  async roles(caller: RightsCaller, request?: unknown): Promise<EdubridgeRole[]> {
    const cached = (request as Record<string, unknown> | undefined)?.[EDUBRIDGE_MEMBERSHIP_KEY] as IEdubridgeMembership | undefined;
    return (cached ?? (await this.membershipOf(caller))).roles;
  }

  /**
   * Права страниц стола — строки таблицы ролей пайщика как есть: право на все
   * объекты (`read:all`) страницу «своего» не открывает, у владельца без
   * договора преподавателя стол преподавателя закрыт. До подключения
   * расширения кооперативом страниц нет — у председателя одна лишь настройка
   * расширения. Пайщик без подписанной оферты видит страницу подключения
   * соответствующего стола.
   */
  async resolveGrants(ctx: DesktopGrantsRequest): Promise<string[]> {
    const m = await this.membershipOf(
      ctx.username ? { username: ctx.username, role: ctx.userRole, status: ctx.userStatus } : null,
      ctx.coopname
    );
    if (!m.onboarded) return m.coreRoles.includes('Chairman') ? ['Extension:configure'] : [];
    const grants = new Set(expandGrantsForRoles(m.roles));
    if (m.username) {
      if (!m.facts.isLearner) grants.add('Onboarding:learner');
      if (!m.facts.isTeacher) grants.add('Onboarding:teacher');
    }
    return [...grants];
  }

  private membershipOf(caller: RightsCaller | null, coopname = platformSettings().coopname): Promise<IEdubridgeMembership> {
    return this.membership.resolve(
      coopname,
      caller
        ? // Статус в запросе приходит строкой — это то же значение, что в enum расширения.
          { username: caller.username, role: caller.role ?? undefined, status: (caller.status ?? undefined) as MonoAccountStatus | undefined }
        : null
    );
  }
}
