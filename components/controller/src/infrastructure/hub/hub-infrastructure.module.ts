import { Module } from '@nestjs/common';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';
import { HubClientService } from './hub-client.service';

/**
 * Модуль связи с бэкендом кооператива-оператора платформы (хаба).
 */
@Module({
  imports: [VaultDomainModule],
  providers: [HubClientService],
  exports: [HubClientService],
})
export class HubInfrastructureModule {}
