import { Inject, Injectable } from '@nestjs/common';
import type { IBranchPort, InnerBranch } from '@coopenomics/innercoop';
import {
  BRANCH_BLOCKCHAIN_PORT,
  type BranchBlockchainPort,
} from '~/domain/branch/interfaces/branch-blockchain.port';

/**
 * Реализация `IBranchPort`: наружу отданы только выборки.
 *
 * Заводить, менять и удалять участки расширение не может — это решение совета,
 * которое проводит ядро; в контракте таких операций нет намеренно.
 */
@Injectable()
export class BranchInnercoopAdapter implements IBranchPort {
  constructor(
    @Inject(BRANCH_BLOCKCHAIN_PORT)
    private readonly branchBlockchainPort: BranchBlockchainPort
  ) {}

  async getBranches(coopname: string): Promise<InnerBranch[]> {
    return this.branchBlockchainPort.getBranches(coopname);
  }

  async getBranch(coopname: string, braname: string): Promise<InnerBranch | null> {
    return this.branchBlockchainPort.getBranch(coopname, braname);
  }
}
