import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { SubgraphRegistryService } from '../gateway/subgraph-registry.service';
import { SupergraphRefreshService } from '../gateway/supergraph-refresh.service';

/**
 * Endpoint'ы для статуса и force-recompose supergraph'а.
 *
 * Фоновый recompose делает dynamic supergraph manager по polling'у
 * (COMPOSITION_POLL_INTERVAL_MS, default 10 сек). `POST refresh` форсит
 * немедленный recompose — install pipeline зовёт его после записи в
 * registry, чтобы новый subgraph стал маршрутизируемым без ожидания tick'а.
 */
@Controller('v1/internal/composition')
export class CompositionController {
  constructor(
    private readonly registry: SubgraphRegistryService,
    private readonly refreshService: SupergraphRefreshService,
  ) {}

  @Get('status')
  async status() {
    const list = await this.registry.listForCompose();
    return {
      subgraphCount: list.length,
      subgraphs: list,
    };
  }

  @Post('refresh')
  @HttpCode(202)
  async refresh() {
    const outcome = await this.refreshService.trigger();
    const list = await this.registry.listForCompose();
    return {
      accepted: true,
      gatewayReady: outcome.ready,
      recomposed: outcome.recomposed,
      ...(outcome.error !== undefined ? { error: outcome.error } : {}),
      currentSubgraphCount: list.length,
    };
  }
}
