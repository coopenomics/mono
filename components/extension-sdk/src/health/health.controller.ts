import { Controller, Get } from '@nestjs/common';

/**
 * Стандартный healthcheck endpoint расширения.
 *
 * Orchestrator опрашивает этот endpoint после `docker compose up -d`;
 * только после `200 OK` пишет subgraph URL в registry и триггерит
 * gateway recompose.
 *
 * Использование:
 *
 *   @Module({ controllers: [HealthController], ... })
 *
 * Endpoint: `GET /_health` → `{ status: 'ok', version, uptime }`.
 */
@Controller('_health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  health(): { status: 'ok'; version: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? 'unknown',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }
}
