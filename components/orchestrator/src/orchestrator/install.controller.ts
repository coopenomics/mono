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

interface UninstallResult {
  ok: boolean;
  deactivated: string;
}

@Controller('v1/internal/extensions')
export class InstallController {
  constructor(
    private readonly orchestrator: InstallOrchestratorService,
    private readonly registry: SubgraphRegistryService,
  ) {}

  @Post('install')
  async install(@Body() input: InstallExtensionInput): Promise<InstallOutcome> {
    return this.orchestrator.install(input);
  }

  @Delete('uninstall/:packageId')
  async uninstall(@Param('packageId') packageId: string): Promise<UninstallResult> {
    await this.registry.deactivate(packageId);
    return { ok: true, deactivated: packageId };
  }
}
