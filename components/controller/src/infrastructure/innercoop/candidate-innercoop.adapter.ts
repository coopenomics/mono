import { Inject, Injectable } from '@nestjs/common';
import type { ICandidatePort, IMonoAccount, InnerCandidate, InnerCandidateFilter, InnerPage, InnerPageRequest } from '@coopenomics/innercoop';
import { CANDIDATE_DATA_PORT, type CandidateDataPort } from '~/domain/registration/ports/candidate-data.port';

/**
 * Реализация `ICandidatePort`.
 *
 * Право видеть заявки проверяет ядро по переданной учётной записи — порт этого
 * не делает и делать не должен: он не знает, что расширение считает своим.
 */
@Injectable()
export class CandidateInnercoopAdapter implements ICandidatePort {
  constructor(
    @Inject(CANDIDATE_DATA_PORT)
    private readonly candidateDataPort: CandidateDataPort
  ) {}

  async getCandidates(
    currentUser: IMonoAccount,
    filter?: InnerCandidateFilter,
    page?: InnerPageRequest
  ): Promise<InnerPage<InnerCandidate>> {
    return this.candidateDataPort.getCandidates(currentUser as any, filter as any, page as any);
  }
}
