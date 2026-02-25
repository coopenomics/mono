import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CaslAbilityFactory, type UserForAbility } from './casl-ability.factory';
import { Action } from './actions';
import { Subject } from './subjects';
import config from '~/config/config';

export const CHECK_ABILITY_KEY = 'check_ability';

/**
 * Декоратор для указания требуемых прав
 */
export function CheckAbility(action: Action, subject: Subject) {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(CHECK_ABILITY_KEY, { action, subject }, descriptor?.value || target);
  };
}

/**
 * CASL Guard — проверяет granular permissions.
 * Работает ПАРАЛЛЕЛЬНО с RolesGuard для обратной совместимости.
 * Если @CheckAbility не установлен, пропускает (как и раньше).
 */
@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    // server-secret bypass
    if (request.headers['server-secret'] === config.server_secret) {
      return true;
    }

    const requirement = this.reflector.get<{ action: Action; subject: Subject }>(
      CHECK_ABILITY_KEY,
      context.getHandler(),
    );

    // Если @CheckAbility не установлен, пропускаем (обратная совместимость)
    if (!requirement) {
      return true;
    }

    const { user } = request;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    const userForAbility: UserForAbility = {
      username: user.username,
      role: user.role,
      permissions: user.grantedPermissions || [],
    };

    const ability = this.caslAbilityFactory.createForUser(userForAbility);

    if (!ability.can(requirement.action, requirement.subject)) {
      throw new ForbiddenException(
        `Недостаточно прав: ${requirement.action} ${requirement.subject}`,
      );
    }

    return true;
  }
}
