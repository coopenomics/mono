import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import {
  createPaginationResult,
  PaginationInputDTO,
  PaginationResult,
} from '~/application/common/dto/pagination.dto';
import { ProcessRegistryService } from '~/domain/process-registry/services/process-registry.service';
import { ProcessViewDTO } from '../dto/process-view.dto';
import { ProcessSummaryDTO } from '../dto/process-summary.dto';
import { ProcessesFilterInput } from '../dto/processes-filter.input';

const paginatedProcesses = createPaginationResult(ProcessSummaryDTO, 'ProcessSummary');

@Resolver()
export class ProcessRegistryResolver {
  constructor(private readonly processRegistryService: ProcessRegistryService) {}

  @Query(() => ProcessViewDTO, {
    name: 'process',
    description: 'Получить полную картину процесса ledger2 по process_hash',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getProcess(
    @Args('hash') hash: string,
    @Args('coopname') coopname: string
  ): Promise<ProcessViewDTO> {
    return this.processRegistryService.getProcess(hash, coopname) as unknown as Promise<ProcessViewDTO>;
  }

  @Query(() => paginatedProcesses, {
    name: 'processes',
    description: 'Листинг процессов ledger2 с пагинацией и фильтрами',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async listProcesses(
    @Args('filter') filter: ProcessesFilterInput,
    @Args('pagination') pagination: PaginationInputDTO
  ): Promise<PaginationResult<ProcessSummaryDTO>> {
    return this.processRegistryService.listProcesses(filter, pagination) as unknown as Promise<
      PaginationResult<ProcessSummaryDTO>
    >;
  }
}
