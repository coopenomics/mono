import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { hasServerSecret } from './server-secret';

/** JWT-гард для GraphQL. При валидном `server-secret` проверка не выполняется. */
@Injectable()
export class GqlJwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    if (hasServerSecret(request?.headers)) {
      return request;
    }

    // WebSocket-соединение
    if (ctx.getType() === 'ws') {
      const { connectionParams } = ctx.getContext();
      return { headers: { authorization: connectionParams?.authorization } };
    }

    return request;
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = this.getRequest(context);

    if (hasServerSecret(request?.headers)) {
      return true;
    }

    return super.canActivate(context);
  }
}

/** В запросе есть заголовок Authorization — клиент представился, а не пришёл гостем. */
function hasAuthorizationHeader(headers: Record<string, any> | undefined): boolean {
  const value = headers?.authorization ?? headers?.Authorization;
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Опциональный JWT-гард для GraphQL: для запросов, доступных и гостю, и пайщику,
 * где состав ответа зависит от того, кто спрашивает.
 *
 * Различает два случая, которые раньше сливались в один:
 * - заголовка Authorization нет — гость, `request.user` пустой, запрос идёт дальше;
 * - заголовок есть, но токен негоден (истёк, подделан, сессия завершена) — отказ.
 *
 * Молчаливое понижение до гостя здесь вредно: клиент, который представился,
 * получал ответ «для незнакомца» с кодом 200 и принимал его за свой. Так рабочий
 * стол приезжал без единого права, и пайщика уводило на «Недостаточно прав
 * доступа». Отказ клиент умеет обрабатывать — обновить токен или войти заново;
 * гостевой ответ он от настоящего отличить не может.
 */
@Injectable()
export class OptionalGqlJwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (user) {
      return user;
    }
    if (!hasAuthorizationHeader(this.getRequest(context)?.headers)) {
      return null;
    }
    if (err instanceof Error) {
      // Отказ стратегии (сессия завершена, пайщик не найден) — отдаём как есть,
      // формулировку клиент распознаёт.
      throw err;
    }
    // Истёкший или испорченный токен passport отказом не считает — только «нет
    // пользователя». Формулировка та же, что у стратегии: клиент узнаёт потерю
    // доступа по слову «авторизац» и сам уводит на вход.
    throw new UnauthorizedException('Сессия завершена, требуется повторная авторизация');
  }
}

/** JWT-гард для обычных HTTP-ручек (не GraphQL). */
@Injectable()
export class HttpJwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = this.getRequest(context);

    if (hasServerSecret(request?.headers)) {
      return true;
    }

    return super.canActivate(context);
  }
}

/**
 * Проверка доступа по ролям из `@AuthRoles`.
 *
 * 1. Валидный `server-secret` — доступ разрешён.
 * 2. Роли не заданы — доступ открыт.
 * 3. Пользователь обращается к своим ресурсам (`username` вложенный в `data`/`filter`
 *    либо плоским аргументом совпадает с `user.username`) — разрешено.
 * 4. У пользователя есть одна из разрешённых ролей — разрешено.
 * 5. Иначе — отказ.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  // Токен указан явно: пакет собирается esbuild'ом, а он не умеет
  // `emitDecoratorMetadata`. Без `@Inject` Nest не увидел бы `design:paramtypes`,
  // построил бы гард без аргументов, и `reflector` оказался бы `undefined` —
  // отказ приходил бы не отказом, а 500 на первом же запросе с ролями.
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    if (hasServerSecret(request?.headers)) {
      return true;
    }

    const allowedRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!allowedRoles) {
      return true;
    }

    const { user } = request;

    const args = ctx.getArgs();
    const data = args.data;
    const filter = args.filter;

    if ((data && data.username && user.username === data.username) ||
        (filter && filter.username && user.username === filter.username) ||
        (args.username && user.username === args.username)) {
      return true;
    }

    if (allowedRoles.includes(user.role)) {
      return true;
    }

    throw new UnauthorizedException(`Недостаточно прав доступа`);
  }
}

/**
 * Статус пайщика, дающий доступ. Литерал, а не enum домена: каркас расширения
 * не зависит от доменных пакетов (INV-007), а в JWT статус и так приезжает строкой.
 * Доменный источник значения — `MonoAccountStatus.Active` в ядре.
 */
const ACTIVE_USER_STATUS = 'active';

/**
 * Разрешает доступ только пайщикам в статусе `active`.
 * При валидном `server-secret` проверка не выполняется — как в `RolesGuard`.
 */
@Injectable()
export class ActiveUserStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    if (hasServerSecret(request?.headers)) {
      return true;
    }

    const user = request.user as { status?: string } | undefined;
    if (!user?.status) {
      throw new ForbiddenException('Требуется авторизованный пользователь');
    }

    if (user.status !== ACTIVE_USER_STATUS) {
      throw new ForbiddenException(
        'Доступ только для пайщиков в статусе «active»',
      );
    }

    return true;
  }
}
