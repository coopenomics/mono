import { Module } from '@nestjs/common';
import { DocumentModule } from '../document/document.module';
import { MeetResolver } from './resolvers/meet.resolver';
import { MeetService } from './services/meet.service';
import { MeetEventService } from './services/meet-event.service';
import { MeetInteractor } from './interactors/meet.interactor';
import { AgendaNotificationService } from '../agenda/services/agenda-notification.service';
import { DecisionNotificationService } from '../agenda/services/decision-notification.service';
import { MeetDomainModule } from '~/domain/meet/meet-domain.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { UserInfrastructureModule } from '~/infrastructure/user/user-infrastructure.module';
import { MeetInfrastructureModule } from '~/infrastructure/meet/meet-infrastructure.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { BlockchainModule } from '~/infrastructure/blockchain/blockchain.module';
import { DocumentDomainModule } from '~/domain/document/document.module';

@Module({
  imports: [
    DocumentModule,
    DocumentDomainModule,
    BlockchainModule,
    MeetDomainModule,
    UserInfrastructureModule,
    UserDomainModule,
    MeetInfrastructureModule,
    AccountInfrastructureModule,
  ],
  controllers: [],
  providers: [
    MeetResolver,
    MeetService,
    MeetEventService,
    MeetInteractor,
    AgendaNotificationService,
    DecisionNotificationService,
  ],
  exports: [AgendaNotificationService, DecisionNotificationService],
})
export class MeetModule {}
