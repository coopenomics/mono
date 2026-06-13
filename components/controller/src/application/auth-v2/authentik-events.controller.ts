import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import config from '~/config/config';
import { AuditService, AuditRecord, AuditResult } from './audit/audit.service';

/** Payload webhook-mapping'ов authentik (coopid-webhook-body / coopid-oidc-webhook-body). */
export interface AuthentikWebhookBody {
  severity?: string;
  event_action?: string;
  event_user?: string | null;
  // policy_execution (Story 1.5)
  passing?: boolean | null;
  messages?: string[] | null;
  // OIDC / native-события (Story 8.3)
  client_ip?: string | null;
  app?: string | null;
  created?: string | null;
}

/**
 * Семантические имена для ключевых OIDC-операций. Остальные подписанные
 * native-события authentik зеркалятся как `Authentik<Action>` (Story 8.3 — AC:
 * Oidc* для операций + Authentik* для native-событий). Все OIDC-операции
 * выполняет authentik, контроллер узнаёт о них только через этот webhook.
 */
const OIDC_EVENT_MAP: Record<string, string> = {
  login: 'OidcLoginSuccess',
  logout: 'OidcLogout',
  authorize_application: 'OidcTokenIssued',
};

/** Native-действия authentik, для которых result = failure (а не success). */
const FAILURE_ACTIONS = new Set(['login_failed', 'suspicious_request', 'policy_exception']);

function pascalCase(action: string): string {
  return action
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Маппинг webhook-события authentik в audit-запись. Чистая функция (юнит-тесты).
 * - policy_execution + passing=false ⇒ слабый пароль (Story 1.5; execution_logging
 *   включён ТОЛЬКО у парольной политики CoopID).
 * - login/logout/authorize_application ⇒ семантические Oidc* (Story 8.3).
 * - прочие подписанные native-события ⇒ Authentik<Action> (Story 8.3).
 */
export function mapAuthentikEvent(body: AuthentikWebhookBody): AuditRecord | null {
  const action = body?.event_action;
  if (!action) return null;

  if (action === 'policy_execution') {
    if (body.passing !== false) return null;
    return {
      event: 'WeakPasswordRejected',
      subjectId: body.event_user ?? null,
      actor: body.event_user ?? null,
      result: 'failure',
      context: {
        messages: body.messages ?? [],
        authentik_created: body.created ?? null,
      },
    };
  }

  const event = OIDC_EVENT_MAP[action] ?? `Authentik${pascalCase(action)}`;
  const result: AuditResult = FAILURE_ACTIONS.has(action) ? 'failure' : 'success';
  return {
    event,
    subjectId: body.event_user ?? null,
    actor: body.event_user ?? null,
    result,
    ip: body.client_ip ?? null,
    context: {
      authentik_action: action,
      app: body.app ?? null,
      authentik_created: body.created ?? null,
    },
  };
}

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Internal-приёмник событий authentik (Story 1.5). Не маршрутизируется caddy —
 * достижим только из docker-сети; дополнительно защищён shared-токеном.
 */
@Controller('coop/internal')
export class AuthentikEventsController {
  private readonly logger = new Logger(AuthentikEventsController.name);

  constructor(private readonly audit: AuditService) {}

  @Post('authentik-events')
  @HttpCode(204)
  async handle(
    @Headers('x-authentik-webhook-token') token: string | undefined,
    @Body() body: AuthentikWebhookBody,
  ): Promise<void> {
    if (!tokenMatches(token, config.authV2.webhookToken)) throw new UnauthorizedException();

    const record = mapAuthentikEvent(body);
    if (!record) return; // не наш кейс — молча принимаем, authentik не должен ретраить

    try {
      await this.audit.record(record);
    } catch (e) {
      this.logger.error(`Не удалось записать audit ${record.event}: ${e instanceof Error ? e.message : e}`);
      throw new ServiceUnavailableException('audit storage unavailable');
    }
  }
}
