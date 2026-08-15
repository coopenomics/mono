import { Module } from '@nestjs/common';
import { ParticipantResolver } from './resolvers/participant.resolver';
import { ParticipantService } from './services/participant.service';
import { ParticipantNotificationService } from './services/participant-notification.service';
import { ParticipantInteractor } from './interactors/participant.interactor';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { GatewayDomainModule } from '~/domain/gateway/gateway-domain.module';
import { NotificationModule } from '~/application/notification/notification.module';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { GatewayModule } from '~/application/gateway/gateway.module';
import { UserInfrastructureModule } from '~/infrastructure/user/user-infrastructure.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';

@Module({
  imports: [
    DocumentDomainModule,
    AccountDomainModule,
    GatewayDomainModule,
    // Сценарии платежей (GATEWAY_INTERACTOR_PORT) раздаёт приложение шлюза.
    GatewayModule,
    NotificationModule,
    TokenApplicationModule,
    UserDomainModule,
    UserInfrastructureModule,
    AccountInfrastructureModule,
  ],
  controllers: [],
  providers: [ParticipantResolver, ParticipantService, ParticipantNotificationService, ParticipantInteractor],
  exports: [ParticipantNotificationService, ParticipantInteractor],
})
export class ParticipantModule {}
