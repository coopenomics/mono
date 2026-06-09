import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Guard для GraphQL resolver'ов расширения. Достаёт Bearer-токен из
 * Authorization-header'а, проверяет подпись через ExtensionJwtStrategy.
 *
 * Используется через `@UseGuards(ExtensionJwtAuthGuard)` на resolver'е /
 * на отдельном поле. Для HTTP-controller'а (например `/_health`) — НЕ нужен;
 * healthcheck оставляем публичным.
 */
@Injectable()
export class ExtensionJwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext().req;
  }
}
