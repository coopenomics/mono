import { Module } from '@nestjs/common';
import { SystemService } from './services/system.service';
import { SystemResolver } from './resolvers/system.resolver';
import { SystemController } from './controllers/system.controller';
import { SystemDomainModule } from '~/domain/system/system-domain.module';
import { ProviderModule } from '~/application/provider/provider.module';
import { SystemInteractor } from './interactors/system.interactor';
import { LoadContactsInteractor } from './interactors/load-contacts.interactor';
import { WifInteractor } from './interactors/wif.interactor';
import { InitInteractor } from './interactors/init.interactor';
import { InstallInteractor } from './interactors/install.interactor';
import { SystemDomainAdapter } from './adapters/system-domain.adapter';
import { SYSTEM_DOMAIN_PORT } from '~/domain/system/interfaces/system-domain.port';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { PaymentMethodInfrastructureModule } from '~/infrastructure/payment-method/payment-method-infrastructure.module';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { SettingsInfrastructureModule } from '~/infrastructure/settings/settings-infrastructure.module';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { NodeSyncHealthService } from './services/node-sync-health.service';
import { NodeSyncResolver } from './resolvers/node-sync.resolver';

@Module({
  imports: [
    SystemDomainModule,
    RedisModule,
    ProviderModule,
    TokenApplicationModule,
    UserDomainModule,
    VaultDomainModule,
    PaymentMethodInfrastructureModule,
    AccountDomainModule,
    SettingsInfrastructureModule,
  ],
  controllers: [SystemController],
  providers: [
    SystemService,
    SystemResolver,
    NodeSyncHealthService,
    NodeSyncResolver,
    SystemInteractor,
    LoadContactsInteractor,
    WifInteractor,
    InitInteractor,
    InstallInteractor,
    { provide: SYSTEM_DOMAIN_PORT, useClass: SystemDomainAdapter },
  ],
  exports: [SystemInteractor, SYSTEM_DOMAIN_PORT],
})
export class SystemModule {}
