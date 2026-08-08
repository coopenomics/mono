import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { MutationLogRepository, MUTATION_LOG_REPOSITORY } from '~/domain/mutation-log/repositories/mutation-log.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { config } from '~/config';

/**
 * Интерсептор для централизованного логирования всех GraphQL мутаций
 * Сохраняет информацию о выполнении мутаций, включая:
 * - Имя мутации
 * - Пользователя
 * - Аргументы (санитизированные от wif)
 * - Продолжительность выполнения
 * - Статус (success/error)
 */
@Injectable()
export class MutationLoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(MUTATION_LOG_REPOSITORY)
    private readonly mutationLogRepository: MutationLogRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MutationLoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const ctx = gqlContext.getContext();

    // Проверяем, является ли это мутацией
    const operationType = info?.operation?.operation;
    if (operationType !== 'mutation') {
      return next.handle();
    }

    const mutationName = info.fieldName;
    const args = gqlContext.getArgs();
    const user = ctx.req?.user;
    // Публичные мутации (логин, регистрация) выполняются без JWT — у них нет
    // user.username, а колонка mutation_logs.username NOT NULL. Пишем sentinel
    // вместо undefined, иначе INSERT падает «null value in column username» на
    // каждой анонимной мутации (sentinel вместо nullable-колонки — чтобы фикс не
    // зависел от synchronize и работал на проде, где миграция эту колонку не
    // трогала).
    const username = user?.username ?? 'anonymous';
    const startTime = Date.now();

    // Санитизация аргументов - удаляем wif ключи
    const sanitizedArgs = this.sanitizeArguments(args);
    const coopname = this.extractCoopname(args);

    return next.handle().pipe(
      tap(() => {
        // Логируем успешное выполнение
        const duration = Date.now() - startTime;
        this.logger.info(`[INTERCEPTOR] Мутация ${mutationName} выполнена успешно за ${duration}мс`, {
          username,
          coopname,
          arguments: sanitizedArgs,
        });
        this.saveMutationLog({
          coopname,
          mutation_name: mutationName,
          username,
          arguments: sanitizedArgs,
          duration_ms: duration,
          status: 'success',
        }).catch((error) => {
          this.logger.error(`[INTERCEPTOR] Ошибка сохранения лога мутации ${mutationName}: ${error.message}`, error.stack);
        });
      }),
      catchError((error: any) => {
        // Логируем ошибку
        const duration = Date.now() - startTime;
        this.logger.info(`[INTERCEPTOR] Мутация ${mutationName} завершилась ошибкой за ${duration}мс: ${error.message}`, {
          username,
          coopname,
          arguments: sanitizedArgs,
          error: error.message,
        });
        this.saveMutationLog({
          coopname,
          mutation_name: mutationName,
          username,
          arguments: sanitizedArgs,
          duration_ms: duration,
          status: 'error',
          error_message: error.message || 'Unknown error',
        }).catch((logError) => {
          this.logger.error(
            `[INTERCEPTOR] Ошибка сохранения лога ошибки мутации ${mutationName}: ${logError.message}`,
            logError.stack
          );
        });

        // Повторно выбрасываем ошибку
        return throwError(() => error);
      })
    );
  }

  /**
   * Санитизация аргументов - удаление wif ключей
   */
  private sanitizeArguments(args: any): Record<string, any> {
    if (!args || typeof args !== 'object') {
      return {};
    }

    const sanitized = JSON.parse(JSON.stringify(args));
    this.removeWifKeys(sanitized);
    return sanitized;
  }

  /**
   * Рекурсивное удаление wif ключей из объекта
   */
  private removeWifKeys(obj: any): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item) => this.removeWifKeys(item));
      return;
    }

    for (const key in obj) {
      if (key === 'wif' || key === 'private_key' || key === 'privateKey') {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.removeWifKeys(obj[key]);
      }
    }
  }

  /**
   * Извлечение coopname из аргументов
   */
  private extractCoopname(_args: any): string | undefined {
    return config.coopname;
  }

  /**
   * Асинхронное сохранение лога мутации
   */
  private async saveMutationLog(data: {
    coopname?: string;
    mutation_name: string;
    username: string;
    arguments: Record<string, any>;
    duration_ms: number;
    status: 'success' | 'error';
    error_message?: string;
  }): Promise<void> {
    try {
      await this.mutationLogRepository.create(data);
    } catch (error: any) {
      // Логируем ошибку, но не прерываем выполнение
      this.logger.error(`[INTERCEPTOR] Ошибка сохранения лога мутации в БД: ${error.message}`, error.stack);
    }
  }
}
