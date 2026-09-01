import { Injectable, Logger } from '@nestjs/common';
import { Counter, register as globalRegistry, type Registry } from 'prom-client';

/**
 * Контур аутентификации как метка метрики. Сейчас живой источник — только новый
 * CoopID (`oidc`); метка `legacy` зарезервирована под параллельный контур миграции
 * (Эпик 7 / Story 7.12 — alert по `auth_errors_total{contour="oidc"}`).
 */
export type AuthContour = 'oidc' | 'legacy';

/**
 * Идемпотентная регистрация счётчика: повторный вызов конструктора (юнит-тест,
 * HMR, повторная сборка модуля) переиспользует уже зарегистрированный на реестре
 * счётчик вместо throw «metric already registered».
 */
function ensureCounter(
  registry: Registry,
  config: { name: string; help: string; labelNames: string[] },
): Counter<string> {
  const existing = registry.getSingleMetric(config.name);
  if (existing) return existing as Counter<string>;
  return new Counter({ ...config, registers: [registry] });
}

/**
 * Auth-специфичные метрики контура CoopID (Story 9.11, NFR28). Счётчики живут на
 * ГЛОБАЛЬНОМ реестре prom-client — его же по умолчанию отдаёт `@willsoto`-эндпоинт
 * GET `/metrics` (там же `defaultMetrics` — процессные метрики Node), поэтому
 * отдельной проводки в экспозицию не нужно.
 *
 * `auth_login_success_rate` из AC — НЕ хранимая метрика, а производное PromQL
 * `auth_login_success_total / auth_login_attempts_total` (та же связка, на которой
 * стоит alert Story 7.12); хранить производную счётчиком было бы неверно.
 *
 * Инкремент — телеметрия, не критпуть аутентификации: любой сбой записи метрики
 * проглатывается (`safe`), запрос на вход он уронить не может.
 */
@Injectable()
export class AuthMetricsService {
  private readonly logger = new Logger(AuthMetricsService.name);
  private readonly attempts: Counter<string>;
  private readonly success: Counter<string>;
  private readonly errors: Counter<string>;

  constructor() {
    this.attempts = ensureCounter(globalRegistry, {
      name: 'auth_login_attempts_total',
      help: 'Число попыток входа (этап-2 timestamp-handshake) по контуру',
      labelNames: ['contour'],
    });
    this.success = ensureCounter(globalRegistry, {
      name: 'auth_login_success_total',
      help: 'Число успешных входов по контуру (success_rate = success/attempts в PromQL)',
      labelNames: ['contour'],
    });
    this.errors = ensureCounter(globalRegistry, {
      name: 'auth_errors_total',
      help: 'Число ошибок входа по контуру и типизированному коду ошибки',
      labelNames: ['contour', 'error_code'],
    });
  }

  /** Попытка входа (вызывать на входе в этап-2 до любых проверок). */
  loginAttempt(contour: AuthContour = 'oidc'): void {
    this.safe(() => this.attempts.inc({ contour }));
  }

  /** Успешный вход (вызывать после выдачи токенов). */
  loginSuccess(contour: AuthContour = 'oidc'): void {
    this.safe(() => this.success.inc({ contour }));
  }

  /** Ошибка входа с типизированным кодом AuthV2Error. */
  loginError(errorCode: string, contour: AuthContour = 'oidc'): void {
    this.safe(() => this.errors.inc({ contour, error_code: errorCode }));
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.logger.warn(`метрика входа не записана: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
