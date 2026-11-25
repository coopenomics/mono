/**
 * @fileoverview Nest-модуль orchestrator'а: REST-эндпоинты, install-pipeline,
 * shell-out импленты Docker/Health/OCI портов.
 *
 * Story 10.4: добавлены InstallOrchestratorService + порты + shell-out
 * импленты. catalog-delivery base URL берётся из ENV (CATALOG_DELIVERY_BASE_URL).
 */
import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { CompositionController } from './composition.controller';
import { InstallController } from './install.controller';
import { InstallOrchestratorService } from './install-orchestrator.service';
import { APP_GRANTS, DOCKER_RUNNER, HEALTH_PROBE, OCI_TOKEN_CLIENT } from './ports';
import { HttpAppGrants } from './app-grants.impl';
import { loadAppConfig } from '../config/app-config';
import { ShellDockerRunner } from './docker-runner.impl';
import { HttpHealthProbe } from './health-probe.impl';
import { CatalogDeliveryOciTokenClient } from './oci-token-client.impl';

@Module({
  imports: [GatewayModule],
  controllers: [CompositionController, InstallController],
  providers: [
    InstallOrchestratorService,
    { provide: DOCKER_RUNNER, useClass: ShellDockerRunner },
    { provide: HEALTH_PROBE, useClass: HttpHealthProbe },
    {
      provide: OCI_TOKEN_CLIENT,
      useFactory: () => new CatalogDeliveryOciTokenClient(process.env.CATALOG_DELIVERY_BASE_URL ?? 'http://catalog-delivery:3000'),
    },
    {
      // Заявки приложений на порты ядра. Без SERVER_SECRET узла заявку
      // завести нечем — приложение ставится без доступа к портам ядра.
      provide: APP_GRANTS,
      useFactory: () => {
        const secret = process.env.SERVER_SECRET;
        if (!secret) return undefined;
        return new HttpAppGrants(new URL(loadAppConfig().coreSubgraphUrl).origin, secret);
      },
    },
  ],
  // WatcherModule инжектит install-pipeline в on-chain watcher.
  exports: [InstallOrchestratorService],
})
export class OrchestratorModule {}
