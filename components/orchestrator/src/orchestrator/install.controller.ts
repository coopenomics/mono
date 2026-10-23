/**
 * @fileoverview REST API установки/снятия subgraph-расширений.
 *
 * Story 10.4: тонкая обёртка над {@link InstallOrchestratorService}.
 * Реальный pipeline (OCI pull → compose up → healthcheck → registry)
 * живёт в сервисе. Сюда приходят запросы из mono controller'а
 * (mutation approvePackage → orchestrator REST install) и из E2E.
 *
 * `install` возвращает discriminated outcome (`applied | failed`);
 * клиент должен switch'ить на `status` поле.
 */
import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import {
  InstallOrchestratorService,
  InstallExtensionInput,
  InstallOutcome,
} from './install-orchestrator.service';
import { SubgraphRegistryService } from '../gateway/subgraph-registry.service';
import { SupergraphRefreshService } from '../gateway/supergraph-refresh.service';

interface UninstallResult {
  ok: boolean;
  deactivated: string;
}

@Controller('v1/internal/extensions')
export class InstallController {
  constructor(
    private readonly orchestrator: InstallOrchestratorService,
    private readonly registry: SubgraphRegistryService,
    private readonly refresh: SupergraphRefreshService,
  ) {}

  @Post('install')
  async install(@Body() input: InstallExtensionInput): Promise<InstallOutcome> {
    const outcome = await this.orchestrator.install(input);
    // Схема пересобирается сразу, а не на следующем опросе реестра: стол
    // перечитывает расширения после ответа установки.
    if (outcome.status === 'applied') await this.refresh.trigger();
    return outcome;
  }

  @Delete('uninstall/:packageId')
  async uninstall(@Param('packageId') packageId: string): Promise<UninstallResult> {
    await this.registry.deactivate(packageId);
    await this.refresh.trigger();
    return { ok: true, deactivated: packageId };
  }
}
