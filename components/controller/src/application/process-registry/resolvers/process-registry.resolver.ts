import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  GqlJwtAuthGuard,
  PaginatedProcessSummary,
  PaginationInputDTO,
  PaginationResult,
  RequireRight,
  RightsGuard,
} from '@coopenomics/extension-kit';
import { ProcessRegistryService } from '~/domain/process-registry/services/process-registry.service';
import { ProcessViewDTO } from '@coopenomics/extension-kit';
import { ProcessSummaryDTO } from '@coopenomics/extension-kit';
import { ProcessesFilterInput } from '@coopenomics/extension-kit';
import { ProcessContentDTO, processContentRegistry } from '@coopenomics/extension-kit';

const paginatedProcesses = PaginatedProcessSummary;

@Resolver()
export class ProcessRegistryResolver {
  constructor(private readonly processRegistryService: ProcessRegistryService) {}

  @Query(() => ProcessViewDTO, {
    name: 'process',
    description: 'Получить полную картину процесса ledger2 по process_hash',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Process', 'read:all')
  async getProcess(
    @Args('hash') hash: string,
    @Args('coopname') coopname: string
  ): Promise<ProcessViewDTO> {
    return this.processRegistryService.getProcess(hash, coopname) as unknown as Promise<ProcessViewDTO>;
  }

  @Query(() => ProcessContentDTO, {
    name: 'processContent',
    nullable: true,
    description:
      'Содержание процесса словами предметной области: имущество, стороны, суммы, состояние. Пусто, если приложение процесса содержание не описывает',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Process', 'read:all')
  async getProcessContent(
    @Args('hash') hash: string,
    @Args('coopname') coopname: string,
    @Args('process_type') processType: string
  ): Promise<ProcessContentDTO | null> {
    // Содержание описывает приложение процесса; иначе общее — из сводки процесса.
    return processContentRegistry.describe(hash, coopname, processType);
  }

  @Query(() => paginatedProcesses, {
    name: 'processes',
    description: 'Листинг процессов ledger2 с пагинацией и фильтрами',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Process', ['read:own', 'read:all'], { owner: 'filter.username' })
  async listProcesses(
    @Args('filter') filter: ProcessesFilterInput,
    @Args('pagination') pagination: PaginationInputDTO
  ): Promise<PaginationResult<ProcessSummaryDTO>> {
    return this.processRegistryService.listProcesses(filter, pagination) as unknown as Promise<
      PaginationResult<ProcessSummaryDTO>
    >;
  }
}
