import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser, createPaginationResult, PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { CandidateFilterInputDTO } from '~/application/registration/dto/candidate-filter.dto';
import { CapitalCandidateOutputDTO } from '../dto/capital-candidate-output.dto';
import { CapitalRegistrationService } from '../services/capital-registration.service';

const paginatedCapitalCandidatesResult = createPaginationResult(CapitalCandidateOutputDTO, 'PaginatedCapitalCandidates');

@Resolver()
export class CapitalRegistrationResolver {
  constructor(private readonly capitalRegistrationService: CapitalRegistrationService) {}

  @Query(() => paginatedCapitalCandidatesResult, {
    name: 'capitalCandidates',
    description: 'Получение списка кандидатов расширения CAPITAL с обогащенными данными',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getCapitalCandidates(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('filter', { nullable: true }) filter?: CandidateFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<CapitalCandidateOutputDTO>> {
    return await this.capitalRegistrationService.getCapitalCandidates(currentUser, filter, options);
  }
}
