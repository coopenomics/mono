import { timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, NestMiddleware, UnauthorizedException } from '@nestjs/common';

/** Запрос в пределах, которые читает проверка: заголовки. Типы express пакету не подключены. */
interface IncomingRequest {
  headers: Record<string, string | string[] | undefined>;
}

/** Сравнение секретов за постоянное время: длина ответа не выдаёт совпавшую часть. */
function sameSecret(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Служебные маршруты оркестратора (`/v1/internal/**`) принимают только
 * межсервисный секрет узла (487-37).
 *
 * Оркестратор стоит и в сети узла, и в сети приложений: он ходит к бэкендам
 * приложений. Без секрета приложение из своей сети вызывало бы установку и
 * снятие чужих приложений и подменяло бы ключ каталога. Узел без
 * `SERVER_SECRET` секрет не проверяет: так работали узлы до правила, и
 * оркестратор сообщает об этом при запуске.
 */
@Injectable()
export class InternalSecretMiddleware implements NestMiddleware {
  private readonly logger = new Logger(InternalSecretMiddleware.name);
  private readonly secret = process.env.SERVER_SECRET ?? '';

  constructor() {
    if (this.secret.length === 0) {
      this.logger.warn('SERVER_SECRET не задан — служебные маршруты оркестратора открыты без секрета');
    }
  }

  use(req: IncomingRequest, _res: unknown, next: () => void): void {
    if (this.secret.length === 0) return next();
    const provided = req.headers['server-secret'];
    if (!sameSecret(typeof provided === 'string' ? provided : undefined, this.secret)) {
      throw new UnauthorizedException('служебный маршрут оркестратора принимает только секрет узла');
    }
    next();
  }
}
