import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import * as jwt from 'jsonwebtoken';
import config from '~/config/config';
import { tokenTypes } from '~/types/token.types';
import { DomainError } from '@coopenomics/extension-kit';

/** Ответ, которого нет: у подписок и у части контекстов express-объекта Response не бывает. */
const NO_RESPONSE = { header: () => undefined };

/**
 * Ограничитель частоты для операций, помеченных `@Throttle`.
 *
 * Зачем свой: штатный `ThrottlerGuard` берёт запрос через `switchToHttp()`, а в
 * GraphQL там лежит корневой объект резолвера, не запрос. Поэтому до 17.09.2026
 * полсотни `@Throttle` на генерации документов и денежных мутациях были
 * украшением — guard нигде, кроме одной REST-ручки, не стоял, и лимит «три в
 * минуту» никого не ограничивал.
 *
 * Работает только там, где лимит объявлен явно: без `@Throttle` операция
 * пропускается, иначе общий предел `ThrottlerModule.forRoot` (50/мин) накрыл бы
 * весь кабинет — он на одной странице делает много запросов.
 *
 * Счёт ведётся по пайщику, а не по адресу: за одним адресом сидит и семья, и
 * кооперативный участок, где вступают с общего компьютера, — «три генерации
 * документа в минуту» на всех сразу остановило бы приём людей. Адрес остаётся
 * трекером для тех, кто ещё не вошёл.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  /**
   * Пайщик из предъявленного токена. Подпись проверяется тем же секретом, что и
   * при входе: иначе счётчик обходился бы подстановкой чужого имени в заголовок.
   */
  private subjectFromToken(authorization: unknown): string | null {
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
    try {
      const payload = jwt.verify(authorization.slice(7).trim(), config.jwt.secret) as { sub?: string; type?: string };
      if (payload?.type !== tokenTypes.ACCESS || typeof payload.sub !== 'string') return null;
      return payload.sub;
    } catch {
      // Истёкший или поддельный токен — не повод пускать без счёта: считаем по адресу.
      return null;
    }
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Dev-контур: разработчик открывает один и тот же экран десятки раз подряд,
    // а сценарии docs-harness гоняют формы пачками — счётчик здесь только мешает
    // (то же решение, что у AuthRateLimitGuard).
    if (config.env === 'development') return true;

    const type = context.getType<GqlContextType>();
    if (type !== 'graphql' && type !== 'http') return true;

    if (type === 'graphql') {
      // У подписки нет ни адреса, ни ответа: соединение уже проверено в onConnect.
      const operation = GqlExecutionContext.create(context).getInfo()?.operation?.operation;
      if (operation === 'subscription') return true;
    }

    const targets = [context.getHandler(), context.getClass()];
    return this.throttlers.every(
      (throttler) => this.reflector.getAllAndOverride(THROTTLER_LIMIT + throttler.name, targets) === undefined
    );
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const subject = this.subjectFromToken(req?.headers?.authorization);
    return Promise.resolve(subject ? `user:${subject}` : `ip:${req?.ip ?? 'unknown'}`);
  }

  protected getRequestResponse(context: ExecutionContext): { req: Record<string, any>; res: Record<string, any> } {
    if (context.getType<GqlContextType>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context).getContext();
      return { req: gqlContext?.req ?? {}, res: gqlContext?.res ?? NO_RESPONSE };
    }
    const { req, res } = super.getRequestResponse(context);
    return { req, res: res ?? NO_RESPONSE };
  }

  /**
   * Отказ приходит `HttpException` с кодом 429, а не штатным
   * `ThrottlerException`: тот несёт английское «ThrottlerException: Too many
   * requests», которое кабинет показал бы пайщику как есть.
   */
  protected async throwThrottlingException(_context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const seconds = Math.max(1, Math.ceil(detail.timeToBlockExpire || detail.timeToExpire || 0));
    throw new DomainError('GRAPHQL_RATE_LIMITED', { seconds }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
