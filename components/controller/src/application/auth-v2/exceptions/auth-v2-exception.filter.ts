import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AuthV2Error, authV2HttpStatus } from '~/domain/auth-v2/errors/auth-v2.error';

/**
 * Ответ REST-контура auth-v2 (CoopID) на типизированную ошибку; статус — из
 * `authV2HttpStatus`, общего с фильтром GraphQL.
 * Тело ответа — формат OAuth 2.0 `{ error, error_description }` (см. AuthV2Error).
 * Зеркало кодов держит SDK `@coopenomics/auth` (errors.ts) — клиент по `error`
 * выбирает человеко-читаемое сообщение и actionable-подсказку.
 *
 * До Story 1.11 маппинг дублировался inline в каждом контроллере (`toHttp`).
 * Здесь он сведён в один источник: контроллеры контура просто пробрасывают
 * AuthV2Error, фильтр (`@Catch(AuthV2Error)`) единообразно переводит его в HTTP.
 *
 * Подключается через controller-scoped `@UseFilters` (НЕ APP_FILTER): в приложении
 * есть глобальный catch-all `GraphQLExceptionFilter` (useGlobalFilters), который
 * перехватывает AuthV2Error раньше любого APP_FILTER и переформатирует ответ в
 * `{statusCode, message, error}` со статусом 500. Controller-scoped фильтр имеет
 * приоритет над глобальным и пишет OAuth2-тело напрямую в response — глобальный
 * фильтр для этой ошибки уже не вызывается (проверено живьём, Story 1.11).
 */
@Catch(AuthV2Error)
export class AuthV2ExceptionFilter implements ExceptionFilter<AuthV2Error> {
  catch(exception: AuthV2Error, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = authV2HttpStatus(exception.code);
    res.status(status).json(exception.toResponse());
  }
}
