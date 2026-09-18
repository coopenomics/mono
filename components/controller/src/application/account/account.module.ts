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
import { EmailVerificationModule } from '~/application/auth/email-verification/email-verification.module';
import { AuthRateLimitGuard } from '~/application/auth-v2/rate-limit/auth-rate-limit.guard';
import { FILE_STORAGE_PORT } from '@coopenomics/innercoop';
import { bucketProvidersFor } from '@coopenomics/extension-kit';
import { UserAvatarService } from './services/user-avatar.service';

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
    // Отметка «адрес подтверждён кодом» с первого шага регистрации.
    EmailVerificationModule,
  ],
  controllers: [],
  // Лимит на регистрацию: guard из auth-v2 нужен здесь как провайдер модуля —
  // его хранилище (RATE_LIMIT_STORAGE) даёт AuthV2InfrastructureModule выше,
  // а сам AuthV2Module сюда не импортируется (цикл через AccountInfrastructureModule).
  providers: [
    AccountInteractor,
    AccountService,
    AccountResolver,
    RegistrationDeclineListener,
    AuthRateLimitGuard,
    UserAvatarService,
    // Бакет фотографий пайщиков создаётся по объявлению `@UseBucket` сервиса.
    ...bucketProvidersFor(FILE_STORAGE_PORT, [UserAvatarService]),
  ],
  exports: [AccountInteractor, AccountService, UserAvatarService],
})
export class AccountModule {}
