import { Inject, Injectable, Optional } from '@nestjs/common';

import { BranchContract } from 'cooptypes';
import { OnEvent } from '@nestjs/event-emitter';
import type { InnerChainDelta } from '@coopenomics/innercoop';
import {
  BRANCH_PORT,
  POWERS_OF_ATTORNEY_PORT,
  type IBranchPort,
  type IPowersOfAttorneyPort,
} from '@coopenomics/innercoop';


export const MARKETPLACE_KU_CHAIRMAN_SERVICE = Symbol('MARKETPLACE_KU_CHAIRMAN_SERVICE');

interface IBranchesCacheEntry {
  branches: BranchContract.Tables.Branches.IBranch[];
  /** Пары «участок:пайщик» с истёкшей доверенностью — полномочия закрыты. */
  lapsed: Set<string>;
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
 *   2. Общий гард прав сверяет охват права: `listBranamesForMember`
 *      отвечает на `own-KU` (участки, где пайщик председатель или доверенный),
 *      `listChairedBranames` — на `chaired-KU` (участки, где он председатель).
 *
 * **Инвариант**: trustee и trusted имеют ИДЕНТИЧНЫЕ операционные права в
 * marketplace-домене (приёмка, выдача, маркировка, склад, ленты КУ). Этот
 * сервис — единственная точка, где этот инвариант формализован. Любая
 * проверка «является ли пайщик X работником КУ Y» должна идти через него,
 * а не через прямое сравнение с `branch.trustee` или `member.username ==
 * braname`. Исключение — действия председателя участка над его средствами
 * (распределение, веса доверенных, подача расхода): они идут под охватом
 * `chaired-KU`.
 *
 * Источник истины — on-chain таблица `branches` контракта `branch`,
 * читается через `BRANCH_PORT.getBranches(coopname)` и
 * кешируется in-memory с TTL `BRANCHES_CACHE_TTL_MS` (60 сек). Состав КУ
 * меняется редко (`createbranch`/`editbranch`/`delbranch`/`addtrusted`/
 * `deltrusted`), TTL покрывает обычные сценарии. Резолверы, меняющие
 * состав КУ, дёргают `invalidate(coopname)`.
 */
/** Ключ закрытых полномочий: участок и пайщик. */
function lapsedKey(braname: string, account: string): string {
  return `${braname}:${account}`;
}

@Injectable()
export class MarketplaceKuChairmanService {
  private static readonly BRANCHES_CACHE_TTL_MS = 60_000;
  private readonly branchesCache = new Map<string, IBranchesCacheEntry>();

  constructor(
    @Inject(BRANCH_PORT)
    private readonly branchPort: IBranchPort,
    // Доверенности (решение владельца 18.11.2026): истёкшая доверенность закрывает
    // председателю участка и доверенному лицу работу с пунктом выдачи до встречной
    // подписи новой. Без расширения участков проверки нет.
    @Optional() @Inject(POWERS_OF_ATTORNEY_PORT)
    private readonly powersOfAttorney?: IPowersOfAttorneyPort
  ) {}

  async isKuChairman(coopname: string, member_account: string): Promise<boolean> {
    const { branches, lapsed } = await this.getEntry(coopname);
    return branches.some((b) => this.branchIncludesMember(b, member_account, lapsed));
  }

  async isMemberOfBranch(
    coopname: string,
    braname: string,
    member_account: string
  ): Promise<boolean> {
    const { branches, lapsed } = await this.getEntry(coopname);
    const branch = branches.find((b) => b.braname === braname);
    if (!branch) return false;
    return this.branchIncludesMember(branch, member_account, lapsed);
  }

  /**
   * Список branches, в которых пайщик имеет операционные полномочия
   * (trustee либо trusted). Нужен, например, для отображения «своих» КУ
   * в селекторе оператора или для bulk-фильтрации лент.
   */
  async listBranamesForMember(coopname: string, member_account: string): Promise<string[]> {
    const { branches, lapsed } = await this.getEntry(coopname);
    return branches
      .filter((b) => this.branchIncludesMember(b, member_account, lapsed))
      .map((b) => b.braname);
  }

  /** Участки, где пайщик председатель: охват права `chaired-KU`. */
  async listChairedBranames(coopname: string, member_account: string): Promise<string[]> {
    const { branches, lapsed } = await this.getEntry(coopname);
    return branches
      .filter((b) => b.trustee === member_account && !lapsed.has(lapsedKey(b.braname, member_account)))
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
    const { branches, lapsed } = await this.getEntry(coopname);
    const branch = branches.find((b) => b.braname === braname);
    if (!branch) return [];
    return [branch.trustee, ...branch.trusted].filter((account) => !lapsed.has(lapsedKey(braname, account)));
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

  /**
   * Состав участка изменился в цепи (назначен председатель, добавлено или
   * снято доверенное лицо) — кэш сбрасывается сразу. Стол ПВЗ перечитывает
   * «мои участки» по тому же сигналу ленты и получает свежий ответ, а не
   * состав минутной давности (замечание владельца 19.11.2026).
   */
  @OnEvent(`delta::${BranchContract.contractName.production}::${BranchContract.Tables.Branches.tableName}`)
  onBranchesDelta(delta: InnerChainDelta): void {
    this.invalidate(delta.scope);
  }

  /**
   * Доверенность председателя или доверенного лица подписана встречно,
   * отклонена или заменена — меняется, кто работает с пунктом выдачи.
   */
  @OnEvent(`action::${BranchContract.contractName.production}::apprauth`)
  @OnEvent(`action::${BranchContract.contractName.production}::declauth`)
  @OnEvent(`action::${BranchContract.contractName.production}::apprtrusted`)
  @OnEvent(`action::${BranchContract.contractName.production}::decltrusted`)
  onAuthorityAction(record: { data?: { coopname?: string } }): void {
    const coopname = record?.data?.coopname;
    if (coopname) this.invalidate(String(coopname));
    else this.branchesCache.clear();
  }

  private async getBranches(coopname: string): Promise<BranchContract.Tables.Branches.IBranch[]> {
    return (await this.getEntry(coopname)).branches;
  }

  /** Состав участков и закрытые полномочия — один кэш на кооператив. */
  private async getEntry(coopname: string): Promise<IBranchesCacheEntry> {
    const now = Date.now();
    const cached = this.branchesCache.get(coopname);
    if (cached && cached.expires_at > now) return cached;

    const [branches, lapsed] = await Promise.all([
      this.branchPort.getBranches(coopname),
      // Сбой учёта доверенностей не закрывает пункт выдачи: полномочия по составу участка.
      this.powersOfAttorney?.listLapsedAuthorities(coopname).catch(() => []) ?? Promise.resolve([]),
    ]);
    const entry: IBranchesCacheEntry = {
      branches,
      lapsed: new Set(lapsed.map((item) => lapsedKey(item.braname, item.username))),
      expires_at: now + MarketplaceKuChairmanService.BRANCHES_CACHE_TTL_MS,
    };
    this.branchesCache.set(coopname, entry);
    return entry;
  }

  /** Работник участка: председатель или доверенное лицо, и доверенность у него не истекла. */
  private branchIncludesMember(
    branch: BranchContract.Tables.Branches.IBranch,
    member_account: string,
    lapsed: Set<string>
  ): boolean {
    if (lapsed.has(lapsedKey(branch.braname, member_account))) return false;
    return branch.trustee === member_account || branch.trusted.includes(member_account);
  }
}
