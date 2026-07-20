// index.ts
import mongoose from 'mongoose';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import config from './config/config';
import logger from './config/logger';
import { ExpressAdapter } from '@nestjs/platform-express';
import expressApp from './app';
import { WinstonLoggerService } from './application/logger/logger-app.service';
import { GraphQLExceptionFilter } from './infrastructure/graphql/filters/graphql-exceptions.filter';
import { migrateData } from './migrator/migrate';
import { ValidationPipe } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { scrubSensitiveDataFromSentryEvent } from './shared/utils/sentry-scrub-event';

export let nestApp;

/**
 * Получить экземпляр TokenApplicationService из NestJS контейнера
 * Используется для доступа к сервисам токенов из не-NestJS контекстов
 */
export function getTokenApplicationService() {
  if (!nestApp) {
    throw new Error('NestJS application not initialized');
  }
  return nestApp.get('TokenApplicationService');
}

async function bootstrap() {
  // Инициализация Sentry для отслеживания ошибок
  if (config.sentry.dsn) {
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.env,
      // Отправляем ошибки только в production
      beforeSend: (event) => {
        scrubSensitiveDataFromSentryEvent(event);
        if (config.env === 'production') {
          return event;
        }
        // Не логируем полный event — в нём request.headers (JWT) и прочие PII
        logger.error('Sentry event (not sent in development)', {
          event_id: event.event_id,
          level: event.level,
          message: event.message,
          tags: event.tags,
          exception: event.exception,
        });
        return null;
      },
      // Устанавливаем уровень логирования
      debug: config.env === 'development',
      // Отключаем автоматическую отправку ошибок в development
      enabled: config.env === 'production' || !!process.env.SENTRY_FORCE_ENABLED,
    });

    logger.info('Sentry initialized for error tracking');
  } else {
    logger.warn('SENTRY_DSN not configured - Sentry error tracking disabled');
  }

  // Проверяем, был ли запущен режим миграций
  const args = process.argv.slice(2);
  if (args.includes('--migrate')) {
    try {
      await migrateData();
      process.exit(0);
    } catch (error) {
      // migrateData() уже логирует причину; здесь важен только ненулевой
      // exit code. В production Sentry.init() ставит свой глобальный
      // process.on('unhandledRejection', ...) с дефолтным mode: 'warn' —
      // он перехватывает необработанный reject этого await и НЕ роняет
      // процесс (в отличие от штатного поведения Node без Sentry). Без
      // явного process.exit(1) здесь deploy-скрипт получал ложноположительный
      // exit code 0 при реально упавшей миграции (кейс V2.3.2 на testnet
      // 2026-07-19 — TS-ошибка компиляции миграции проглатывалась именно так).
      logger.error('Процесс миграции завершился с ошибкой, выходим с кодом 1', error);
      process.exit(1);
    }
  }

  // Проверяем, был ли запущен режим только миграций (для обратной совместимости)
  if (args.includes('--migrations-only')) {
    try {
      await migrateData();
      logger.info('Режим только миграций - миграции выполнены, сервер не будет запущен');
      process.exit(0);
    } catch (error) {
      logger.error('Процесс миграции завершился с ошибкой, выходим с кодом 1', error);
      process.exit(1);
    }
  }

  // Подключение к MongoDB
  await mongoose.connect(config.mongoose.url);
  logger.info('Connected to MongoDB');

  // Добавьте миддлвар для отключения CSP в локальной разработке
  expressApp.use((req, res, next) => {
    if (config.env !== 'production') {
      res.removeHeader('Content-Security-Policy'); // Отключить CSP для локальной разработки
    }
    next();
  });

  // Создаем приложение NestJS и подключаем Express-приложение как middleware
  nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: new WinstonLoggerService(),
  });

  // Глобальный фильтр для перехвата всех исключений внутри NestJS
  nestApp.useGlobalFilters(new GraphQLExceptionFilter());

  // Добавляем Sentry фильтры и интерцепторы для автоматического отслеживания ошибок
  if (config.sentry.dsn) {
    // Sentry автоматически интегрируется через middleware и не требует дополнительных фильтров
    logger.info('Sentry global error tracking enabled');
  }

  nestApp.useGlobalPipes(
    new ValidationPipe({
      errorHttpStatusCode: 422,
      // whitelist: true, // Удаляет неописанные поля
      // forbidNonWhitelisted: true, // Вызывает ошибку, если переданы лишние поля
      // forbidUnknownValues: true, // Ошибка, если объект отсутствует
    })
  );

  // Подключаем глобальный интерсептор для логирования мутаций
  const mutationLoggingInterceptor = nestApp.get('MutationLoggingInterceptor');
  nestApp.useGlobalInterceptors(mutationLoggingInterceptor);

  // Запуск сервера
  await nestApp.listen(config.port, () => {
    logger.info(`NestJS app with Express routes running on port ${config.port}`);
  });

  // Завершение работы приложения при неожиданных ошибках
  const exitHandler = async () => {
    await mongoose.disconnect();
    logger.info('Server closed');
    process.exit(1);
  };

  const unexpectedErrorHandler = async (error: any) => {
    console.error(error);
    await mongoose.disconnect();
    logger.error(error, { source: 'unexpectedErrorHandler' });
    await exitHandler();
  };

  process.on('uncaughtException', unexpectedErrorHandler);
  process.on('unhandledRejection', unexpectedErrorHandler);

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received');
    await mongoose.disconnect();
    await nestApp.close();
  });
}

/** Не запускать сервер при побочном импорте `~/index` (например, только за `nestApp`). */
if (require.main === module) {
  void bootstrap();
}
