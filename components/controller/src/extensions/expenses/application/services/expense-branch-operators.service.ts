import { Inject, Injectable } from '@nestjs/common';
import { BranchContract } from 'cooptypes';
import { CHAIN_PORT, type IChainPort, type IMonoAccount } from '@coopenomics/innercoop';

/**
 * Кто ведёт кооперативные участки: председатель участка и его доверенные лица
 * по составу участков в цепи (`branch::branches`). Одна проверка на реестр
 * плановых расходов и реестр контрагентов: оба доступны совету целиком и
 * операторам участков — в пределах своих участков.
 */
@Injectable()
export class ExpenseBranchOperatorsService {
  constructor(@Inject(CHAIN_PORT) private readonly chain: IChainPort) {}

  /** Совет кооператива — председатель и члены совета: им реестры расходов открыты целиком. */
  isCouncil(viewer: Pick<IMonoAccount, 'role'>): boolean {
    return viewer.role === 'chairman' || viewer.role === 'member';
  }

  /** Участки, где пайщик — председатель или доверенное лицо. */
  async operatedBranches(coopname: string, username: string): Promise<string[]> {
    return (await this.branches(coopname)).filter((b) => isOperator(b, username)).map((b) => b.braname);
  }

  /** Участок кооператива по имени; `null` — такого участка нет. */
  async findBranch(coopname: string, braname: string): Promise<BranchContract.Tables.Branches.IBranch | null> {
    return (await this.branches(coopname)).find((b) => b.braname === braname) ?? null;
  }

  /** Пайщик — председатель или доверенное лицо участка. */
  isOperatorOf(branch: BranchContract.Tables.Branches.IBranch, username: string): boolean {
    return isOperator(branch, username);
  }

  private async branches(coopname: string): Promise<BranchContract.Tables.Branches.IBranch[]> {
    return (await this.chain.getAllRows(
      BranchContract.contractName.production,
      coopname,
      BranchContract.Tables.Branches.tableName
    )) as BranchContract.Tables.Branches.IBranch[];
  }
}

function isOperator(branch: BranchContract.Tables.Branches.IBranch, username: string): boolean {
  return branch.trustee === username || branch.trusted.includes(username);
}
