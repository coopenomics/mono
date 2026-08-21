import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  DESKTOP_GRANTS_REGISTRY_PORT,
  type IDesktopGrantsHook,
  type IDesktopGrantsRegistryPort,
  type InnerDesktopGrantsContext,
} from '@coopenomics/innercoop';
import { CAPITAL_EXTENSION_NAME } from '../../constants/capital-agreement-ids';

/**
 * Права на столе «Благорост» — канон авторизации столов.
 *
 * Набор нарочно зеркалит прежнюю видимость по `meta.roles`, чтобы переход на
 * канон ничего не менял для пайщиков:
 *   `Capital:access`   — страницы, что были открыты всем (`roles: []`), включая гостя;
 *   `Capital:board`    — страницы совета (`roles: ['chairman', 'member']`);
 *   `Capital:chairman` — страницы председателя (`roles: ['chairman']`).
 *
 * Зачем нужен канон, если поведение то же: только grant-стол могут сужать
 * другие приложения через `IDesktopGrantsFilterHook` (например, «Образовательный
 * мост» оставляет «Благорост» преподавателям). Стол на ролях сузить нельзя.
 */
export const CAPITAL_GRANTS = {
  ACCESS: 'Capital:access',
  BOARD: 'Capital:board',
  CHAIRMAN: 'Capital:chairman',
} as const;

@Injectable()
export class CapitalDesktopGrantsProvider implements IDesktopGrantsHook, OnModuleInit {
  readonly extensionName = CAPITAL_EXTENSION_NAME;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(this);
  }

  async resolveGrants(ctx: InnerDesktopGrantsContext): Promise<string[]> {
    const grants: string[] = [CAPITAL_GRANTS.ACCESS];
    if (ctx.userRole === 'member' || ctx.userRole === 'chairman') grants.push(CAPITAL_GRANTS.BOARD);
    if (ctx.userRole === 'chairman') grants.push(CAPITAL_GRANTS.CHAIRMAN);
    return grants;
  }
}
