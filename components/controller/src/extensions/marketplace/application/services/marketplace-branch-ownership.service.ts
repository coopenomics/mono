import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BRANCH_PORT, type IBranchPort } from '@coopenomics/innercoop';

export const MARKETPLACE_BRANCH_OWNERSHIP_SERVICE = Symbol(
  'MarketplaceBranchOwnershipService'
);

/**
 * Проверяет, что аккаунт правомочен оперировать от имени кооперативного участка.
 *
 * Правомочны: председатель КУ (`branch.trustee`) либо его доверенные лица
 * (`branch.trusted[]`, до 3 individual-аккаунтов; см. `branch::addtrusted`).
 *
 * Branches не реплицируются в Postgres — chain RPC через port. ADR-011
 * не нарушается: read-path вычисляет authorization, а не отдаёт прикладную
 * сущность пользователю.
 */
@Injectable()
export class MarketplaceBranchOwnershipService {
  constructor(
    @Inject(BRANCH_PORT)
    private readonly branchPort: IBranchPort
  ) {}

  async canActAsBraname(coopname: string, account: string, braname: string): Promise<boolean> {
    const branch = await this.branchPort.getBranch(coopname, braname);
    if (!branch) return false;
    if (branch.trustee === account) return true;
    return branch.trusted?.includes(account) ?? false;
  }

  async assertCanActAsBraname(
    coopname: string,
    account: string,
    braname: string
  ): Promise<void> {
    const branch = await this.branchPort.getBranch(coopname, braname);
    if (!branch) {
      throw new NotFoundException(`Кооперативный участок ${braname} не найден.`);
    }
    const allowed =
      branch.trustee === account || (branch.trusted?.includes(account) ?? false);
    if (!allowed) {
      throw new ForbiddenException(
        'Действие доступно только председателю кооперативного участка или его доверенному лицу.'
      );
    }
  }
}
