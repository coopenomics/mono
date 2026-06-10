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
import { AuditService, AuditRecord } from './audit/audit.service';

/** Payload, который формирует webhook-mapping coopid-webhook-body в authentik. */
export interface AuthentikWebhookBody {
  severity?: string;
  event_action?: string;
  event_user?: string | null;
  passing?: boolean | null;
  messages?: string[] | null;
  created?: string | null;
}

/**
 * Маппинг webhook-события authentik в audit-запись. Чистая функция (юнит-тесты).
 * execution_logging включён ТОЛЬКО у парольной политики CoopID (см. blueprint),
 * поэтому policy_execution + passing=false ⇒ отказ по слабому паролю.
 */
export function mapAuthentikEvent(body: AuthentikWebhookBody): AuditRecord | null {
  if (body?.event_action !== 'policy_execution' || body?.passing !== false) return null;
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
