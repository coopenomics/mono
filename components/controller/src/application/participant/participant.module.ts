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
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
import { UserInfrastructureModule } from '~/infrastructure/user/user-infrastructure.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';

@Module({
  imports: [
    DocumentDomainModule,
    AccountDomainModule,
    GatewayDomainModule,
    GatewayInfrastructureModule,
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
