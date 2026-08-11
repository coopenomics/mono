import { Inject, Injectable } from '@nestjs/common';
import { PaginationInputDTO, PaginationResult,
  CandidateFilterInputDTO,
  CandidateStatus,
} from '@coopenomics/extension-kit';
import { IMonoAccount,
  CANDIDATE_PORT,
  type ICandidatePort,
} from '@coopenomics/innercoop';
import { CapitalCandidateOutputDTO } from '../dto/capital-candidate-output.dto';
import { CONTRIBUTOR_REPOSITORY, ContributorRepository } from '../../../domain/repositories/contributor.repository';

@Injectable()
export class CapitalRegistrationService {
  constructor(
    @Inject(CANDIDATE_PORT)
    private readonly candidateDataPort: ICandidatePort,
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository
  ) {}

  /**
   * Получение кандидатов ядра, обогащенных данными благороста
   */
  async getCapitalCandidates(
    currentUser: IMonoAccount,
    filter?: CandidateFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<CapitalCandidateOutputDTO>> {
    // Получаем базовый список кандидатов через порт ядра
    const baseResult = await this.candidateDataPort.getCandidates(currentUser, filter, options);

    // Обогащаем данные из репозитория участников благороста
    const enrichedItems = await Promise.all(
      baseResult.items.map(async (item) => {
        const contributor = await this.contributorRepository.findByUsername(item.username);

        return {
          ...item,
          // Состояние заявки контракт описывает строкой, форма ответа —
          // перечнем с теми же значениями: приведение на границе.
          status: item.status as CandidateStatus,
          capital_status: contributor?.status,
          rate_per_hour: contributor?.rate_per_hour,
          hours_per_day: contributor?.hours_per_day,
          contributed_as_investor: contributor?.contributed_as_investor,
          contributed_as_creator: contributor?.contributed_as_creator,
          contributed_as_author: contributor?.contributed_as_author,
          contributed_as_coordinator: contributor?.contributed_as_coordinator,
          contributed_as_contributor: contributor?.contributed_as_contributor,
          contributed_as_propertor: contributor?.contributed_as_propertor,
          level: contributor?.level,
          about: contributor?.about,
          contributor_hash: contributor?.contributor_hash,
          memo: contributor?.memo,
        };
      })
    );

    return {
      ...baseResult,
      items: enrichedItems,
    };
  }
}
