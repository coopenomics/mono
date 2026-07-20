import { Module, forwardRef } from '@nestjs/common';
import { GatewayExpiryCronService } from './gateway-expiry-cron.service';
import { ProviderDomainService } from './provider-domain.service';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { AccountModule } from '~/application/account/account.module';
import { AccountInteractor } from '~/application/account/interactors/account.interactor';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { EventsInfrastructureModule } from '~/infrastructure/events/events.module';
import { SystemDomainModule } from '~/domain/system/system-domain.module';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';

@Module({
  imports: [
    AccountDomainModule,
    forwardRef(() => AccountModule),
    forwardRef(() => UserDomainModule),
    forwardRef(() => TokenApplicationModule),
    EventsInfrastructureModule,
    SystemDomainModule,
    GatewayInfrastructureModule,
  ],
  exports: [],
  providers: [GatewayExpiryCronService, AccountInteractor, ProviderDomainService],
})
export class GatewayDomainModule {}
