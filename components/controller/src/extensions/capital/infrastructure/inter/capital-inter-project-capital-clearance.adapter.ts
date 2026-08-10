import { Inject, Injectable } from '@nestjs/common';
import type { InterProjectCapitalClearancePort } from '@coopenomics/inter';
import {
  APPENDIX_REPOSITORY,
  type AppendixRepository,
} from '../../domain/repositories/appendix.repository';
import { PermissionsService } from '../../application/services/permissions.service';

@Injectable()
export class CapitalInterProjectCapitalClearanceAdapter implements InterProjectCapitalClearancePort {
  constructor(
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository,
    private readonly permissionsService: PermissionsService
  ) {}

  async listUsernamesWithConfirmedProjectClearance(projectHash: string): Promise<string[]> {
    return this.appendixRepository.findDistinctUsernamesWithConfirmedClearanceByProjectHash(projectHash);
  }

  async canReadProjectCommunication(input: {
    username: string;
    role?: string;
    projectHash: string;
  }): Promise<boolean> {
    return this.permissionsService.canReadProjectCommunication(input.projectHash, {
      username: input.username,
      role: input.role ?? 'user',
    });
  }
}
