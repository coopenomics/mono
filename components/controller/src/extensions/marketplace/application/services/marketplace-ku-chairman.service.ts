import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { BranchContract } from 'cooptypes';
import { BRANCH_PORT, type IBranchPort } from '@coopenomics/innercoop';


export const MARKETPLACE_KU_CHAIRMAN_SERVICE = Symbol('MARKETPLACE_KU_CHAIRMAN_SERVICE');

interface IBranchesCacheEntry {
  branches: BranchContract.Tables.Branches.IBranch[];
  expires_at: number;
}

/**
 * Эпик 2 (ПВЗ): источник состава кооперативных участков (branches) для
 * marketplace-домена. Используется в двух местах:
 *
 *   1. `MarketplaceMembershipGuard` берёт `isKuChairman(coopname, username)`
 *      для контекста `mapCoreRolesToMarketplaceRoles` — marketplace-роль
 *      `operator` выдаётся пайщику, если он `trustee` ИЛИ `trusted[i]`
 *      хотя бы одного branch'а кооператива.
 *   2. Resolver'ы с ownership `:own-KU` (return-claim, issuance, warehouse)
 *      берут `isMemberOfBranch(coopname, braname, username)` для проверки
 *      «принадлежит ли пайщик именно этому КУ».
 *
 * **Инвариант**: trustee и trusted имеют ИДЕНТИЧНЫЕ операционные права в
 * marketplace-домене (приёмка, выдача, маркировка, склад, ленты КУ). Этот
 * сервис — единственная точка, где этот инвариант формализован. Любая
 * проверка «является ли пайщик X работником КУ Y» должна идти через него,
 * а не через прямое сравнение с `branch.trustee` или `member.username ==
 * braname`.
 *
 * Источник истины — on-chain таблица `branches` контракта `branch`,
 * читается через `BRANCH_PORT.getBranches(coopname)` и
 * кешируется in-memory с TTL `BRANCHES_CACHE_TTL_MS` (60 сек). Состав КУ
 * меняется редко (`createbranch`/`editbranch`/`delbranch`/`addtrusted`/
 * `deltrusted`), TTL покрывает обычные сценарии. Резолверы, меняющие
 * состав КУ, дёргают `invalidate(coopname)`.
 */
@Injectable()
export class MarketplaceKuChairmanService {
  private static readonly BRANCHES_CACHE_TTL_MS = 60_000;
  private readonly branchesCache = new Map<string, IBranchesCacheEntry>();

  constructor(
    @Inject(BRANCH_PORT)
    private readonly branchPort: IBranchPort
  ) {}

  async isKuChairman(coopname: string, member_account: string): Promise<boolean> {
    const branches = await this.getBranches(coopname);
    return branches.some((b) => this.branchIncludesMember(b, member_account));
  }

  async isMemberOfBranch(
    coopname: string,
    braname: string,
    member_account: string
  ): Promise<boolean> {
    const branches = await this.getBranches(coopname);
    const branch = branches.find((b) => b.braname === braname);
    if (!branch) return false;
    return this.branchIncludesMember(branch, member_account);
  }

  /**
   * Общая own-KU guard-проверка для resolver'ов (Economy, Order и др.):
   * бросает `ForbiddenException`, если пайщик не председатель/доверенный
   * ИМЕННО этого КУ. Каждый resolver сам решает, нужен ли предварительный
   * bypass по `read:all` своего resource — эта проверка про членство в КУ,
   * не про capability роли.
   */
  async assertIsMemberOfBranch(
    coopname: string,
    braname: string,
    member_account: string,
    message = 'Доступно председателю и доверенным этого кооперативного участка'
  ): Promise<void> {
    const isMember = await this.isMemberOfBranch(coopname, braname, member_account);
    if (!isMember) {
      throw new ForbiddenException(message);
    }
  }

  /**
   * Список branches, в которых пайщик имеет операционные полномочия
   * (trustee либо trusted). Нужен, например, для отображения «своих» КУ
   * в селекторе оператора или для bulk-фильтрации лент.
   */
  async listBranamesForMember(coopname: string, member_account: string): Promise<string[]> {
    const branches = await this.getBranches(coopname);
    return branches
      .filter((b) => this.branchIncludesMember(b, member_account))
      .map((b) => b.braname);
  }

  /**
   * Operational-роли конкретного КУ: trustee (председатель) + все
   * trusted (доверенные лица). Семантика «равны в правах» — порядок
   * списка не несёт смысла, потребитель решает сам кому слать первому
   * (например, push можно посылать всем, а единственная подпись —
   * trustee'у).
   */
  async listOperatorsOfBranch(coopname: string, braname: string): Promise<string[]> {
    const branches = await this.getBranches(coopname);
    const branch = branches.find((b) => b.braname === braname);
    if (!branch) return [];
    return [branch.trustee, ...branch.trusted];
  }

  /**
   * Председатель КУ — только trustee. Используется когда по контракту
   * требуется именно `trustee` (например, on-chain действие, где adressee
   * — формальный председатель), не операционный персонал.
   */
  /** Все участки кооператива — для ролей с правом «по всему кооперативу». */
  async listAllBranames(coopname: string): Promise<string[]> {
    const branches = await this.getBranches(coopname);
    return branches.map((b) => b.braname);
  }

  async getTrusteeOfBranch(coopname: string, braname: string): Promise<string | null> {
    const branches = await this.getBranches(coopname);
    return branches.find((b) => b.braname === braname)?.trustee ?? null;
  }

  invalidate(coopname: string): void {
    this.branchesCache.delete(coopname);
  }

  private async getBranches(coopname: string): Promise<BranchContract.Tables.Branches.IBranch[]> {
    const now = Date.now();
    const cached = this.branchesCache.get(coopname);
    if (cached && cached.expires_at > now) return cached.branches;

    const branches = await this.branchPort.getBranches(coopname);
    this.branchesCache.set(coopname, {
      branches,
      expires_at: now + MarketplaceKuChairmanService.BRANCHES_CACHE_TTL_MS,
    });
    return branches;
  }

  private branchIncludesMember(
    branch: BranchContract.Tables.Branches.IBranch,
    member_account: string
  ): boolean {
    return branch.trustee === member_account || branch.trusted.includes(member_account);
  }
}
