import { Module, forwardRef } from '@nestjs/common';
import { CandidateDataAdapter } from './candidate-data.adapter';
import { CANDIDATE_DATA_PORT } from '~/domain/registration/ports/candidate-data.port';
import { RegistrationModule } from '~/application/registration/registration.module';

@Module({
  imports: [
    // Цикл проходит через composition root расширений:
    // обратная сторона: registration-domain → extension-domain → extensions.module →
    // innercoop-bridge → registration-infrastructure → registration.module →
    // registration-domain. Законен: мост по своей роли знает обе стороны —
    // и порты ядра, и расширения, которые их реализуют, — а поток вступления
    // спрашивает у расширений условия участия (хуки онбординга).
    forwardRef(() => RegistrationModule),
  ],
  providers: [
    CandidateDataAdapter,
    {
      provide: CANDIDATE_DATA_PORT,
      useClass: CandidateDataAdapter,
    },
  ],
  exports: [CANDIDATE_DATA_PORT],
})
export class RegistrationInfrastructureModule {}
