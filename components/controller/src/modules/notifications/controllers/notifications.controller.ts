import { Controller, All, Req, Res, UseGuards, HttpStatus, Next } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import config from '~/config/config';
import { HttpJwtAuthGuard } from '~/modules/auth/guards/http-jwt-auth.guard';
import { NotificationsService } from '../services/notifications.service';
import { CurrentUser } from '~/modules/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

// Type guard для проверки что объект является Express Response БЕЗ ANY
function isExpressResponse(obj: unknown): obj is Response {
  return (
    obj !== null && obj !== undefined && typeof obj === 'object' && 'status' in obj && 'json' in obj && 'headersSent' in obj
  );
}

@Controller('notifications')
@UseGuards(HttpJwtAuthGuard)
export class NotificationsController {
  private proxy: RequestHandler;

  constructor(private readonly notificationsService: NotificationsService) {
    // Создаем прокси middleware для NOVU
    this.proxy = createProxyMiddleware({
      target: config.novu.backend_url,
      changeOrigin: true,
      pathRewrite: {
        '^/notifications': '', // Убираем префикс /notifications
      },
      headers: {
        Authorization: `ApiKey ${config.novu.api_key}`,
      },
      on: {
        error: (err: Error, req: Request, res: unknown) => {
          console.error('Proxy error:', err);
          // Используем type guard для проверки типа БЕЗ ANY
          if (isExpressResponse(res) && !res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              error: 'Ошибка при обращении к сервису уведомлений',
            });
          }
        },
      },
    }) as RequestHandler;
  }

  @All('*')
  async proxyToNovu(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
    @CurrentUser() user: MonoAccountDomainInterface
  ) {
    try {
      // Проверяем что пользователь авторизован
      if (!user || !user.username) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'Требуется аутентификация',
        });
      }

      // Извлекаем subscriberId из различных источников
      const subscriberId = this.notificationsService.extractSubscriberId(req.headers, req.query);

      // ВАЖНО: Проверяем что subscriberId соответствует текущему пользователю
      if (subscriberId) {
        // Ожидаемый формат subscriberId: "{coopname}-{username}"
        const expectedSubscriberId = `${config.coopname}-${user.username}`;

        if (subscriberId !== expectedSubscriberId) {
          console.warn(`Access denied: user ${user.username} tried to access subscriberId ${subscriberId}`);
          return res.status(HttpStatus.FORBIDDEN).json({
            error: `Доступ запрещен. Можно получать только свои уведомления (${expectedSubscriberId})`,
          });
        }

        // Дополнительная валидация через сервис
        this.notificationsService.validateAccess(user, subscriberId);
      }

      // Модифицируем заголовки для передачи в NOVU
      req.headers['x-novu-application-identifier'] = config.novu.app_id;

      // Убираем заголовок authorization чтобы не передавать JWT в NOVU
      delete req.headers['authorization'];

      // Проксируем запрос к NOVU
      this.proxy(req, res, next);
    } catch (error: unknown) {
      console.error('Notification proxy error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка доступа к уведомлениям';
      res.status(HttpStatus.FORBIDDEN).json({
        error: errorMessage,
      });
    }
  }
}
