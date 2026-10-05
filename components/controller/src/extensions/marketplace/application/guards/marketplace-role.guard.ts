import {
  checkRightScope,
  hasServerSecret,
  DomainError,
  GRANTED_SCOPE_KEY,
  platformSettings,
  RIGHT_METADATA_KEY,
  type GrantedAction,
  type IGrantedScope,
  type IRightRequirement,
} from '@coopenomics/extension-kit';
import { Inject, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';

import { marketplaceRightScopes, type MarketplaceCondition } from '../access/marketplace-access-matrix';
import { MarketplaceRightSubjects } from '../access/marketplace-right-subjects.service';
import { MarketplaceRightsService } from '../access/marketplace-rights.service';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MARKETPLACE_ROLES_METADATA_KEY } from '../decorators/marketplace-role.decorator';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';

/**
 * Guard проверки авторизации marketplace.
 *
 * Поддерживает обе семантики (Story 1.6 + Story 1.8):
 *   - `@RequireMarketplaceRole('admin', 'board')` — OR по ролям;
 *   - `@RequireRight('Order', 'create')` — проверка через
 *     централизованную access-matrix (`marketplace-access-matrix.ts`).
 *
 * Если декораторы заданы оба — guard требует выполнения обоих
 * (логическое И). Если ни одного — guard разрешает (по аналогии с core
 * RolesGuard: «нет требования — нет ограничения», membership проверяется
 * отдельно `MarketplaceMembershipGuard`).
 *
 * Право сверяется с таблицей вместе с условием строки (C28-87): роль, которой
 * право положено, получает отказ, пока условие не выполнено — программа не
 * принята советом, заказчик не подключён, хранение выключено.
 *
 * Следом сверяется охват: операция называет источник объекта, справочник
 * объектов отдаёт владельца, участок и получателя, каркас расширений сверяет
 * их с пайщиком. Итог кладётся в запрос — операция читает его `@GrantedScope()`.
 */
/** Отказ по условию строки таблицы прав: что именно ждёт выполнения. */
const CONDITION_DENIALS: Record<MarketplaceCondition, string> = {
  'coop-accepted': 'MARKETPLACE_COOP_NOT_CONNECTED',
  'orderer-onboarded': 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED',
  'containers-enabled': 'MARKETPLACE_CONTAINERS_DISABLED',
  'cells-enabled': 'MARKETPLACE_STORAGE_CELLS_DISABLED',
};

@Injectable()
export class MarketplaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly rights: MarketplaceRightsService,
    private readonly subjects: MarketplaceRightSubjects,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {
    this.logger.setContext(MarketplaceRoleGuard.name);
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<MarketplaceRole[] | undefined>(
      MARKETPLACE_ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );
    const requiredAccess = this.reflector.getAllAndOverride<
      IRightRequirement | undefined
    >(RIGHT_METADATA_KEY, [context.getHandler(), context.getClass()]);

    const noRoles = !requiredRoles || requiredRoles.length === 0;
    if (noRoles && !requiredAccess) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const request = gqlContext.req;

    // Секрет межсервисного обхода сверяет сам каркас: значение ему передал
    // composition root, и сюда оно не попадает вовсе. Читать его из конфига
    // ядра расширению нельзя — это ровно тот секрет, который не должен
    // разъезжаться по коду.
    if (hasServerSecret(request?.headers)) {
      // Межсервисный вызов работает по всему кооперативу.
      const everything: IGrantedScope = { scopes: ['all'], kus: null };
      if (request) request[GRANTED_SCOPE_KEY] = everything;
      return true;
    }

    const currentMember =
      (gqlContext?.currentMember as IMarketplaceCurrentMember | undefined) ??
      (request?.currentMember as IMarketplaceCurrentMember | undefined);

    if (!currentMember) {
      throw DomainError.forbidden('MARKETPLACE_ROLE_GUARD_CONTEXT_MISSING');
    }

    const handlerName = context.getHandler()?.name ?? 'unknown_handler';
    const className = context.getClass()?.name ?? 'unknown_class';
    const memberRoles = currentMember.marketplace_roles as MarketplaceRole[];

    if (!noRoles && requiredRoles) {
      const matched = requiredRoles.find((role) => memberRoles.includes(role));
      if (!matched) {
        this.logger.warn(
          `forbidden-attempt: member=${currentMember.username} action=${className}.${handlerName} requested_role=[${requiredRoles.join(', ')}] actual_marketplace_roles=[${memberRoles.join(', ')}] actual_core_roles=[${currentMember.core_roles.join(', ')}]`
        );
        throw new ForbiddenException(
          `Forbidden: marketplace role '${requiredRoles.join(', ')}' required, member has [${memberRoles.join(', ')}]`
        );
      }
    }

    if (!requiredAccess) return true;
    return this.checkAccess(
      currentMember,
      memberRoles,
      requiredAccess,
      ctx.getArgs<Record<string, unknown>>() ?? {},
      `${className}.${handlerName}`
    ).then((scope) => {
      if (request) request[GRANTED_SCOPE_KEY] = scope;
      return true;
    });
  }

  /**
   * Право по таблице вместе с условием строки, затем охват. Асинхронная
   * часть гарда: проверка одной роли выше отвечает сразу.
   */
  private async checkAccess(
    currentMember: IMarketplaceCurrentMember,
    memberRoles: MarketplaceRole[],
    requiredAccess: IRightRequirement,
    args: Record<string, unknown>,
    operation: string
  ): Promise<IGrantedScope> {
    const coopname = platformSettings().coopname;
    // action может быть массивом — OR: достаточно, чтобы роль удовлетворяла
    // хотя бы одному (см. IRightRequirement). Собираются все данные действия:
    // от них зависит, по какому охвату сверять объект.
    const actions = Array.isArray(requiredAccess.action)
      ? requiredAccess.action
      : [requiredAccess.action];
    const granted: GrantedAction[] = [];
    let missing: MarketplaceCondition | undefined;
    for (const action of actions) {
      const check = await this.rights.check(
        coopname,
        currentMember.username,
        memberRoles,
        requiredAccess.resource,
        action
      );
      if (check.allowed) granted.push({ action, wide: check.wide === true });
      else missing = missing ?? check.missing;
    }
    if (granted.length === 0 && missing) {
      throw DomainError.forbidden(CONDITION_DENIALS[missing]);
    }
    if (granted.length === 0) {
      this.logger.warn(
        `forbidden-attempt: member=${currentMember.username} action=${operation} requested_access=${requiredAccess.resource}:${actions.join('|')} actual_marketplace_roles=[${memberRoles.join(', ')}] actual_core_roles=[${currentMember.core_roles.join(', ')}]`
      );
      throw new ForbiddenException(
        `Forbidden: marketplace access '${requiredAccess.resource}:${actions.join('|')}' required, member has roles [${memberRoles.join(', ')}]`
      );
    }

    const scope = await checkRightScope({
      resource: requiredAccess.resource,
      granted,
      source: requiredAccess.source,
      implied: marketplaceRightScopes,
      args,
      username: currentMember.username,
      kus: () => this.kuChairmanService.listBranamesForMember(coopname, currentMember.username),
      chairedKus: () => this.kuChairmanService.listChairedBranames(coopname, currentMember.username),
      locate: (kind, ids) => this.subjects.locate(coopname, kind, ids),
    });
    if (!scope.allowed) {
      this.logger.warn(
        `forbidden-attempt: member=${currentMember.username} action=${operation} requested_access=${requiredAccess.resource}:${actions.join('|')} scope_denial=${scope.denial} actual_marketplace_roles=[${memberRoles.join(', ')}]`
      );
      throw DomainError.forbidden(scope.denial ?? 'KIT_INSUFFICIENT_RIGHTS');
    }
    return scope.scope;
  }
}
