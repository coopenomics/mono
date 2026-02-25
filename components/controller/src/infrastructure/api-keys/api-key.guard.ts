import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ApiKeyService } from './api-key.service';

/**
 * Guard для аутентификации через API ключ.
 * Проверяет заголовок x-api-key. Если присутствует — валидирует.
 * Работает как альтернатива JWT — не заменяет его.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    const apiKey = request.headers['x-api-key'];
    if (!apiKey) return true;

    const entity = await this.apiKeyService.validateKey(apiKey);
    if (!entity) {
      throw new UnauthorizedException('Невалидный или истёкший API ключ');
    }

    request.apiKeyEntity = entity;
    if (!request.user) {
      request.user = {
        username: entity.created_by,
        role: 'chairman',
        isApiKey: true,
      };
    }

    return true;
  }
}
