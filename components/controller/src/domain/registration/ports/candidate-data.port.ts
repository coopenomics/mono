import { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { CandidateFilterInputDTO } from '~/application/registration/dto/candidate-filter.dto';
import { CandidateOutputDTO } from '~/application/registration/dto/candidate.dto';
import { IMonoAccount } from '@coopenomics/innercoop';

/**
 * Доменный порт для доступа к кандидатам из других модулей (например, расширений)
 */
export interface CandidateDataPort {
  /**
   * Получение кандидатов с пагинацией и проверкой прав доступа
   */
  getCandidates(
    currentUser: IMonoAccount,
    filter?: CandidateFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<CandidateOutputDTO>>;
}

export const CANDIDATE_DATA_PORT = Symbol('CandidateDataPort');
