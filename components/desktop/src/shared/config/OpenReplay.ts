import { env } from './Environment';

export interface OpenReplayTrackerConfig {
  username?: string;
  coopname?: string;
  cooperativeDisplayName?: string;
}

/**
 * Обновляет метаданные пользователя в запущенном OpenReplay tracker'е
 */
export function updateOpenReplayUser(config: OpenReplayTrackerConfig): void {
  if (!process.env.CLIENT || process.env.NODE_ENV !== 'production' || !env.OPENREPLAY_PROJECT_KEY) {
    return;
  }

  try {
    // Импортируем tracker асинхронно, но не ждем
    import('@openreplay/tracker').then(({ tracker }) => {
      if (config.username) {
        tracker.setUserID(config.username);
      }

      if (config.coopname) {
        tracker.setMetadata('coopname', config.coopname);
      }

      if (config.cooperativeDisplayName) {
        tracker.setMetadata('cooperative_name', config.cooperativeDisplayName);
      }
    }).catch((error) => {
      console.error('OpenReplay tracker update error:', error);
    });
  } catch (error) {
    console.error('OpenReplay tracker update error:', error);
  }
}

/**
 * Инициализирует OpenReplay tracker с конфигурацией для захвата сетевых запросов
 * и санитаризацией чувствительных данных
 *
 * Пустой OPENREPLAY_PROJECT_KEY штатно выключает трекер — это и есть рубильник:
 * сессии пишутся с телами запросов, поэтому приёмник должен стоять в нашем
 * контуре, а состав данных — совпадать с опубликованной политикой обработки.
 * Пока приёмник не развёрнут у нас, ключ на прод-контуре держится пустым.
 */
export async function initOpenReplayTracker(config: OpenReplayTrackerConfig = {}): Promise<void> {
  // Проверяем условия для инициализации
  if (!process.env.CLIENT || process.env.NODE_ENV !== 'production' || !env.OPENREPLAY_PROJECT_KEY) {
    return;
  }

  try {
    const { tracker } = await import('@openreplay/tracker');

    // Конфигурируем tracker
    tracker.configure({
      projectKey: env.OPENREPLAY_PROJECT_KEY,
      ingestPoint: 'https://replay.coopenomics.world/api',
      network: {
        capturePayload: true,
        failuresOnly: false,
        ignoreHeaders: ['Cookie', 'Set-Cookie', 'Authorization'],
        sessionTokenHeader: 'X-OpenReplay-SessionToken',
        captureInIframes: true,
        sanitizer: (data) => {
          // Санитаризация WIF в GraphQL мутациях
          if (data.request.body && typeof data.request.body === 'string') {
            try {
              const parsed = JSON.parse(data.request.body);
              if (parsed.variables && parsed.variables.data && parsed.variables.data.wif) {
                parsed.variables.data.wif = '***SANITISED_WIF***';
                data.request.body = JSON.stringify(parsed);
              }
            } catch {
              // Не JSON тело, пропускаем
            }
          }

          // Санитаризация WIF в ответах (если вдруг возвращается)
          if (data.response.body && typeof data.response.body === 'object') {
            const responseBody = data.response.body as any;
            if (responseBody.data && responseBody.data.wif) {
              responseBody.data.wif = '***SANITISED_WIF***';
            }
          }

          // Санитаризация Authorization заголовков в запросах
          if (data.request.headers && data.request.headers['Authorization']) {
            data.request.headers['Authorization'] = 'Bearer ***SANITISED_TOKEN***';
          }

          // Санитаризация других потенциально чувствительных заголовков
          if (data.request.headers && data.request.headers['authorization']) {
            data.request.headers['authorization'] = 'Bearer ***SANITISED_TOKEN***';
          }

          return data;
        }
      }
    });

    // Устанавливаем user ID если есть
    if (config.username) {
      tracker.setUserID(config.username);
    }

    // Устанавливаем метаданные кооператива
    if (config.coopname) {
      tracker.setMetadata('coopname', config.coopname);
    }

    if (config.cooperativeDisplayName) {
      tracker.setMetadata('cooperative_name', config.cooperativeDisplayName);
    }

    // Запускаем tracker
    await tracker.start();
    console.log('OpenReplay tracker started');

  } catch (error) {
    console.error('OpenReplay tracker initialization error:', error);
  }
}
