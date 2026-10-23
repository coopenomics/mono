import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithLocale } from '@coopenomics/i18n/server';
import { resolveRequestLocale } from './request-locale';

/**
 * Открывает контекст языка на весь запрос: резолверы, сервисы и валидация
 * ниже по стеку получают язык через `currentLocale()` / `t()` без передачи
 * параметром. Подключена в AppModule после разбора тела запроса — иначе
 * продолжение после чтения тела выполнялось бы вне контекста.
 */
@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    runWithLocale(resolveRequestLocale(req), () => next());
  }
}
