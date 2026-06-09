import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { SubgraphRegistryService } from '../gateway/subgraph-registry.service';

/**
 * Endpoint'ы для статуса и force-recompose supergraph'а.
 *
 * IntrospectAndCompose polling каждые 10 сек подхватит изменения registry
 * и без force-refresh'а; force-endpoint полезен для интеграционных тестов
 * и для быстрого reaction'а после install (когда не хочется ждать polling).
 *
 * **Важно:** реальный recompose делает сам Apollo Gateway по polling'у; этот
 * endpoint только возвращает текущее состояние registry. Принудительная
 * пересборка сейчас выполняется через изменение registry + ожидание
 * polling'а (≤10 сек). Если позже понадобится hard-trigger — потребуется
 * GraphQL Plugin для inline-вызова supergraphSdl.fetch().
 */
@Controller('v1/internal/composition')
export class CompositionController {
  constructor(private readonly registry: SubgraphRegistryService) {}

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
    // Триггер сейчас implicit — IntrospectAndCompose polling.
    // Возвращаем 202 Accepted чтобы orchestrator install pipeline мог
    // вызывать этот endpoint и продолжать без ожидания.
    const list = await this.registry.listForCompose();
    return {
      accepted: true,
      currentSubgraphCount: list.length,
      pollIntervalMs: 10000,
    };
  }
}
