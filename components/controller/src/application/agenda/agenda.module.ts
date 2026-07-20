import { Module } from '@nestjs/common';
import { AgendaResolver } from './resolvers/agenda.resolver';
import { AgendaService } from './services/agenda.service';
import { AgendaInteractor } from './interactors/agenda.interactor';
import { AgendaDomainModule } from '~/domain/agenda/agenda-domain.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { UserInfrastructureModule } from '~/infrastructure/user/user-infrastructure.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { DocumentDomainModule } from '~/domain/document/document.module';

@Module({
  imports: [
    AgendaDomainModule,
    DocumentDomainModule,
    UserInfrastructureModule,
    UserDomainModule,
    AccountInfrastructureModule,
  ],
  controllers: [],
  providers: [AgendaInteractor, AgendaResolver, AgendaService],
  exports: [AgendaService],
})
export class AgendaModule {}
