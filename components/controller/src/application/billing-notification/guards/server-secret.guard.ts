import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import config from '~/config/config';

/**
 * Имя заголовка с общим секретом провайдера ↔ coopback.
 * Симметрично ServerSecretGuard на стороне провайдера (Epic 12/13): тот же
 * SERVER_SECRET, тот же заголовок.
 */
export const SERVER_SECRET_HEADER = 'server-secret';

/**
 * Guard для входящих REST-запросов от провайдера (Восход backend).
 * Epic 14: провайдер шлёт notification-intent в coopback по этому каналу.
 * Проверяет заголовок `server-secret` против config.server_secret
 * timing-safe сравнением.
 */
@Injectable()
export class ServerSecretGuard implements CanActivate {
  private readonly logger = new Logger(ServerSecretGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request?.headers?.[SERVER_SECRET_HEADER];
    const expected = config.server_secret;

    if (!expected) {
      this.logger.error('SERVER_SECRET не настроен на coopback — отклоняю запрос');
      throw new UnauthorizedException('Server secret is not configured');
    }
    if (!provided || typeof provided !== 'string') {
      throw new UnauthorizedException(`Отсутствует заголовок ${SERVER_SECRET_HEADER}`);
    }
    if (!this.timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Неверный server-secret');
    }
    return true;
  }

  /** Timing-safe сравнение строк (защита от timing attacks). */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
