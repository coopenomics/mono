import { Module } from '@nestjs/common';
import { AccountResolver } from './resolvers/account.resolver';
import { AccountService } from './services/account.service';
import { AccountInteractor } from './interactors/account.interactor';
import { RegistrationDeclineListener } from './services/registration-decline.listener';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { EventsInfrastructureModule } from '~/infrastructure/events/events.module';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';

@Module({
  imports: [
    AccountDomainModule,
    UserDomainModule,
    TokenApplicationModule,
    EventsInfrastructureModule,
    // Поле Account.has_password резолвится по vault-блобу пайщика. Берём
    // инфраструктурный модуль (VAULT_REPOSITORY), а не AuthV2Module: тот через
    // AccountInfrastructureModule замыкается обратно на AccountModule (цикл).
    AuthV2InfrastructureModule,
  ],
  controllers: [],
  providers: [AccountInteractor, AccountService, AccountResolver, RegistrationDeclineListener],
  exports: [AccountInteractor, AccountService],
})
export class AccountModule {}
