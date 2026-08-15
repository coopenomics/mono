import { Module } from '@nestjs/common';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { AccountModule } from '~/application/account/account.module';
import { AccountInteractor } from '~/application/account/interactors/account.interactor';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { EventsInfrastructureModule } from '~/infrastructure/events/events.module';
import { SystemDomainModule } from '~/domain/system/system-domain.module';

@Module({
  imports: [
    AccountDomainModule,
    AccountModule,
    UserDomainModule,
    TokenApplicationModule,
    EventsInfrastructureModule,
    SystemDomainModule,
  ],
  exports: [],
  // Реестр провайдеров раздаёт инфраструктура шлюза — здесь он объявлялся
  // вторым экземпляром, в который никто ничего не регистрировал.
  providers: [AccountInteractor],
})
export class GatewayDomainModule {}
