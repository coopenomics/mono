import { Module } from '@nestjs/common';
import { MembershipExitResolver } from './resolvers/membership-exit.resolver';
import { MembershipExitService } from './services/membership-exit.service';
import { MembershipExitAuthorizationListener } from './services/membership-exit-authorization.listener';
import { ParticipantModule } from '../participant/participant.module';
import { TokenApplicationModule } from '../token/token-application.module';
import { NotificationModule } from '../notification/notification.module';
import { SystemModule } from '../system/system.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { EventsInfrastructureModule } from '~/infrastructure/events/events.module';
import { AuthorizationModule } from '~/application/auth-v2/authorization/authorization.module';

/**
 * Модуль выхода пайщика из кооператива: генерация документов выхода (200/201),
 * подача заявления с подтверждением по email (off-chain черновик → токен →
 * письмо → confirm → registrator::exitcoop) и предрасчёт суммы возврата паевого.
 *
 * Порты ACCOUNT_BLOCKCHAIN_PORT / BLOCKCHAIN_PORT / USER_WALLET_REPOSITORY
 * предоставляются глобальными модулями (blockchain.module, typeorm.module).
 */
@Module({
  imports: [
    ParticipantModule,
    TokenApplicationModule,
    NotificationModule,
    SystemModule,
    UserDomainModule,
    EventsInfrastructureModule,
    // Право на генерацию документов выхода — из матрицы прав (`@CheckAbility`).
    AuthorizationModule,
  ],
  providers: [MembershipExitResolver, MembershipExitService, MembershipExitAuthorizationListener],
  exports: [MembershipExitService],
})
export class MembershipExitModule {}
