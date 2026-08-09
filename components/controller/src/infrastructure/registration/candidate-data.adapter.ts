import { Injectable } from '@nestjs/common';
import { CandidateDataPort } from '~/domain/registration/ports/candidate-data.port';
import { RegistrationService } from '~/application/registration/services/registration.service';
import { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { CandidateFilterInputDTO } from '~/application/registration/dto/candidate-filter.dto';
import { CandidateOutputDTO } from '~/application/registration/dto/candidate.dto';
import { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

@Injectable()
export class CandidateDataAdapter implements CandidateDataPort {
  constructor(private readonly registrationService: RegistrationService) {}

  async getCandidates(
    currentUser: MonoAccountDomainInterface,
    filter?: CandidateFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<CandidateOutputDTO>> {
    return await this.registrationService.getCandidates(currentUser, filter, options);
  }
}
