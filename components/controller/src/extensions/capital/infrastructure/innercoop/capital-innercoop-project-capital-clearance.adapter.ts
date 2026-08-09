import { Inject, Injectable } from '@nestjs/common';
import type { IProjectCapitalClearancePort } from '@coopenomics/innercoop';
import {
  APPENDIX_REPOSITORY,
  type AppendixRepository,
} from '../../domain/repositories/appendix.repository';

@Injectable()
export class CapitalInnercoopProjectCapitalClearanceAdapter implements IProjectCapitalClearancePort {
  constructor(
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository
  ) {}

  async listUsernamesWithConfirmedProjectClearance(projectHash: string): Promise<string[]> {
    return this.appendixRepository.findDistinctUsernamesWithConfirmedClearanceByProjectHash(projectHash);
  }
}
