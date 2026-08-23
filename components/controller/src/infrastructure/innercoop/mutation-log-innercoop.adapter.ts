import { Inject, Injectable } from '@nestjs/common';
import type {
  IMutationLogPort,
  InnerMutationLogEntry,
  InnerMutationLogFilter,
  InnerPage,
  InnerPageRequest,
} from '@coopenomics/innercoop';
import {
  MUTATION_LOG_REPOSITORY,
  type MutationLogRepository,
} from '~/domain/mutation-log/repositories/mutation-log.repository';

/**
 * Реализация `IMutationLogPort`: наружу отданы только выборки.
 *
 * Писать в журнал расширение не может — записи делает ядро на каждой операции
 * интерфейса, и именно поэтому журналу можно верить.
 */
@Injectable()
export class MutationLogInnercoopAdapter implements IMutationLogPort {
  constructor(
    @Inject(MUTATION_LOG_REPOSITORY)
    private readonly mutationLogRepository: MutationLogRepository
  ) {}

  async findAll(
    filter?: InnerMutationLogFilter,
    page?: InnerPageRequest
  ): Promise<InnerPage<InnerMutationLogEntry>> {
    return this.mutationLogRepository.findAll(filter as any, page as any);
  }

  async findById(id: string): Promise<InnerMutationLogEntry | null> {
    return this.mutationLogRepository.findById(id);
  }
}
