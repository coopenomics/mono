import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import config from '~/config/config';

@Injectable()
export class HttpJwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Проверка заголовка server-secret
    if (request.headers['server-secret'] === config.server_secret) {
      return request;
    }

    // Обработка обычного HTTP-запроса
    return request;
  }

  canActivate(context: ExecutionContext) {
    const request = this.getRequest(context);

    // Пропуск аутентификации при наличии server-secret
    if (request.headers['server-secret'] === config.server_secret) {
      return true;
    }

    return super.canActivate(context);
  }
}
