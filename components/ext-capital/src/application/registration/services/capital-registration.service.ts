import { Inject, Injectable } from '@nestjs/common';
import { CANDIDATE_DATA_PORT, CandidateDataPort } from '~/domain/registration/ports/candidate-data.port';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { CandidateFilterInputDTO } from '~/application/registration/dto/candidate-filter.dto';
import { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { CapitalCandidateOutputDTO } from '../dto/capital-candidate-output.dto';
import { CONTRIBUTOR_REPOSITORY, ContributorRepository } from '~/extensions/capital/domain/repositories/contributor.repository';

@Injectable()
export class CapitalRegistrationService {
  constructor(
    @Inject(CANDIDATE_DATA_PORT)
    private readonly candidateDataPort: CandidateDataPort,
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository
  ) {}

  /**
   * Получение кандидатов ядра, обогащенных данными капитализации
   */
  async getCapitalCandidates(
    currentUser: MonoAccountDomainInterface,
    filter?: CandidateFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<CapitalCandidateOutputDTO>> {
    // Получаем базовый список кандидатов через порт ядра
    const baseResult = await this.candidateDataPort.getCandidates(currentUser, filter, options);

    // Обогащаем данные из репозитория участников капитализации
    const enrichedItems = await Promise.all(
      baseResult.items.map(async (item) => {
        const contributor = await this.contributorRepository.findByUsername(item.username);

        return {
          ...item,
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
