/**
 * @fileoverview Nest-модуль orchestrator'а: REST-эндпоинты, install-pipeline,
 * shell-out импленты Docker/Health/OCI портов.
 *
 * Story 10.4: добавлены InstallOrchestratorService + порты + shell-out
 * импленты. CA-auth base URL берётся из ENV (CA_AUTH_BASE_URL).
 */
import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { CompositionController } from './composition.controller';
import { InstallController } from './install.controller';
import { InstallOrchestratorService } from './install-orchestrator.service';
import { DOCKER_RUNNER, HEALTH_PROBE, OCI_TOKEN_CLIENT } from './ports';
import { ShellDockerRunner } from './docker-runner.impl';
import { HttpHealthProbe } from './health-probe.impl';
import { CaAuthOciTokenClient } from './oci-token-client.impl';

@Module({
  imports: [GatewayModule],
  controllers: [CompositionController, InstallController],
  providers: [
    InstallOrchestratorService,
    { provide: DOCKER_RUNNER, useClass: ShellDockerRunner },
    { provide: HEALTH_PROBE, useClass: HttpHealthProbe },
    {
      provide: OCI_TOKEN_CLIENT,
      useFactory: () => new CaAuthOciTokenClient(process.env.CA_AUTH_BASE_URL ?? 'http://ca-auth:3000'),
    },
  ],
})
export class OrchestratorModule {}
