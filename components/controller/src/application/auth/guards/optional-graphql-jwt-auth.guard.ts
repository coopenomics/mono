import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Опциональный JWT-гард для GraphQL: НЕ бросает при отсутствии/невалидности
 * токена, а просто оставляет `request.user` пустым. Нужен для запросов,
 * доступных и гостю, и пайщику, где состав ответа зависит от того, кто
 * спрашивает (например, `getDesktop` — гранты столов вычисляются по
 * текущему пользователю, но сама ручка открыта без авторизации).
 */
@Injectable()
export class OptionalGqlJwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  // passport бросает на отсутствии/невалидном токене — гасим в null,
  // запрос продолжается как гостевой.
  handleRequest(_err: any, user: any) {
    return user ?? null;
  }
}
