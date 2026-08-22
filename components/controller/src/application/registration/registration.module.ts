import { Module } from '@nestjs/common';
import { RegistrationResolver } from './resolvers/registration.resolver';
import { RegistrationService } from './services/registration.service';
import { CANDIDATE_DATA_PORT } from '~/domain/registration/ports/candidate-data.port';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { RegistrationDomainModule } from '~/domain/registration/registration-domain.module';
import { ParticipantModule } from '../participant/participant.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { UserInfrastructureModule } from '~/infrastructure/user/user-infrastructure.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';

@Module({
  imports: [
    AccountDomainModule,
    AccountInfrastructureModule,
    RegistrationDomainModule,
    UserDomainModule,
    UserInfrastructureModule,
    ParticipantModule,
  ],
  providers: [
    RegistrationResolver,
    RegistrationService,
    // Порт кандидатов раздаёт тот, кому сценарии вступления и принадлежат.
    // Раньше его держал отдельный `RegistrationInfrastructureModule` с
    // адаптером-транзитом, и ради одного метода инфраструктура импортировала
    // приложение обратно — цикл, который обходили `forwardRef`.
    { provide: CANDIDATE_DATA_PORT, useExisting: RegistrationService },
  ],
  exports: [RegistrationService, CANDIDATE_DATA_PORT],
})
export class RegistrationModule {}
