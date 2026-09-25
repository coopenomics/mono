import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  CapitalBlockchainPort,
  CAPITAL_BLOCKCHAIN_PORT,
} from '../../domain/interfaces/capital-blockchain.port';
import {
  CONTRIBUTOR_REPOSITORY,
  type ContributorRepository,
} from '../../domain/repositories/contributor.repository';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/repositories/project.repository';
import { ContributorStatus } from '../../domain/enums/contributor-status.enum';
import { ProjectStatus } from '../../domain/enums/project-status.enum';
import type { ContributorDomainEntity } from '../../domain/entities/contributor.entity';
import type { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { isLocalProject } from '../../domain/utils/assert-blockchain-project';
import { AssetUtils } from '@coopenomics/extension-kit';
import { ProgramType, getProgramId } from '@coopenomics/innercoop';
import { PROGRAM_WALLET_PORT, type IProgramWalletPort } from '@coopenomics/innercoop';

/**
 * Автоматическая регистрация долей держателей Благороста в активных проектах.
 * Включена всегда; `CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION=off` выключает её
 * целиком — и по событиям, и по расписанию.
 *
 * Выключается только на стенде внешнего слоя, пока идут boot-тесты контракта:
 * они шлют действия прямо в цепь и считают премии вкладчиков точно, а
 * автоматика, заводящая доли параллельно, делала их итог зависимым от того,
 * кто успел раньше (решение владельца 25.09.2026, C28-80). Читается при каждом
 * вызове: стенд включает автоматику обратно пересозданием контроллера.
 */
export function programShareAutoRegistrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION ?? 'on').trim().toLowerCase() !== 'off';
}

/**
 * Сверка баланса программы «Благорост» с долёй в сегментах проектов и вызов regshare при расхождении.
 */
@Injectable()
export class ProgramShareRegistrationService {
  private readonly logger = new Logger(ProgramShareRegistrationService.name);

  constructor(
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(PROGRAM_WALLET_PORT)
    private readonly walletDomainPort: IProgramWalletPort
  ) {}

  /**
   * Обход участников в статусах active/import по active-проектам; при изменении user_shares относительно capital_contributor_shares — regshare.
   */
  async syncProgramSharesForCoop(coopname: string): Promise<void> {
    if (!programShareAutoRegistrationEnabled()) return;
    const projects = await this.findActiveProjects(coopname);
    if (projects.length === 0) {
      this.logger.debug(`Синхронизация regshare: нет active-проектов для ${coopname}`);
      return;
    }

    const contributors = (await this.contributorRepository.findAll()).filter(
      (c) =>
        c.coopname === coopname &&
        (c.status === ContributorStatus.ACTIVE || c.status === ContributorStatus.IMPORT)
    );

    const projectHashes = projects.map((p) => p.project_hash);
    for (const contributor of contributors) {
      await this.syncContributor(coopname, contributor, projectHashes);
    }
  }

  /**
   * Точечная синхронизация regshare для одного пайщика — вызывается из listener'а
   * на дельты `ledger2::userwallets[w.cap.blago]`. Не пишет лог, если у пайщика
   * нет ни одного active-проекта.
   */
  async syncProgramSharesForUser(coopname: string, username: string, knownShares?: string): Promise<void> {
    if (!programShareAutoRegistrationEnabled()) return;
    const projects = await this.findActiveProjects(coopname);
    if (projects.length === 0) return;

    const contributor = (await this.contributorRepository.findAll()).find(
      (c) =>
        c.coopname === coopname &&
        c.username === username &&
        (c.status === ContributorStatus.ACTIVE || c.status === ContributorStatus.IMPORT)
    );
    if (!contributor) return;

    await this.syncContributor(coopname, contributor, projects.map((p) => p.project_hash), knownShares);
  }

  /**
   * Точечная регистрация долей всех активных пайщиков в один проект — вызывается
   * из listener'а на дельты `capital::projects` сразу при появлении проекта.
   *
   * Why: между созданием проекта и его переводом в `result` может пройти меньше
   * минуты; контракт `regshare` принимает только статусы pending|active, а откат
   * `result → active` не предусмотрен — значит пайщики, не успевшие попасть в
   * проект до закрытия окна, теряют долю в нём безвозвратно (инцидент voskhod,
   * компонент 011bcd92…, 2026-06-16). Реакция на событие закрывает окно, не
   * дожидаясь периодического scheduler'а.
   *
   * Переиспользует тот же `syncContributor`, что и обход по расписанию.
   */
  async syncProgramSharesForProject(coopname: string, project_hash: string): Promise<void> {
    if (!programShareAutoRegistrationEnabled()) return;
    const contributors = (await this.contributorRepository.findAll()).filter(
      (c) =>
        c.coopname === coopname &&
        (c.status === ContributorStatus.ACTIVE || c.status === ContributorStatus.IMPORT)
    );
    if (contributors.length === 0) return;

    for (const contributor of contributors) {
      await this.syncContributor(coopname, contributor, [project_hash]);
    }
  }

  /**
   * Только active-проекты: заход долей в pending отключён (решение пользователя
   * 2026-06-16) — заводим/сверяем доли лишь в активных проектах.
   */
  private async findActiveProjects(coopname: string): Promise<ProjectDomainEntity[]> {
    // Личный (локальный) проект живёт только в базе узла — доли в цепи ему
    // не заводятся; до 25.09.2026 каждая попытка кончалась «проект не найден».
    return (await this.projectRepository.findAll()).filter(
      (p) => p.coopname === coopname && p.status === ProjectStatus.ACTIVE && !isLocalProject(p)
    );
  }

  /**
   * @param knownShares баланс Благороста, уже известный вызывающему (из дельты
   *   кошелька). Зеркало кошельков пишет ту же дельту параллельно со
   *   слушателем, и чтение из него отдавало баланс ДО взноса: доля в
   *   активном проекте оставалась старой (C28-80, внешний тест
   *   cap.areg.happy.02).
   */
  private async syncContributor(
    coopname: string,
    contributor: ContributorDomainEntity,
    projectHashes: string[],
    knownShares?: string
  ): Promise<void> {
    const targetShares = knownShares ?? (await this.blagorostShares(coopname, contributor.username));
    if (!targetShares) return;

    const targetParsed = AssetUtils.parseAsset(targetShares);
    if (!targetParsed.symbol) return;

    for (const projectHash of projectHashes) {
      const segment = await this.capitalBlockchainPort.getSegmentByProjectUser(
        coopname,
        projectHash,
        contributor.username
      );

      const registeredStr =
        segment?.capital_contributor_shares ?? AssetUtils.formatAsset(0, targetParsed.symbol);

      if (this.sameAssetAmount(registeredStr, targetShares)) continue;

      try {
        await this.capitalBlockchainPort.registerShare({
          coopname,
          project_hash: projectHash,
          username: contributor.username,
          user_shares: targetShares,
        });
        this.logger.log(
          `regshare: ${contributor.username} → проект ${projectHash}, user_shares=${targetShares} (было ${registeredStr})`
        );
      } catch (error: unknown) {
        // HttpApiError наследует Error, отдельная ветка ничего не добавляла,
        // а в production-образе ломала компиляцию: типы Nest там не резолвятся
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.warn(
          `regshare не выполнен: coop=${coopname} project=${projectHash} user=${contributor.username}: ${message}`,
          stack
        );
      }
    }
  }

  /** Баланс Благороста пайщика (доступно + заблокировано) из зеркала кошельков. */
  private async blagorostShares(coopname: string, username: string): Promise<string | null> {
    const wallet = await this.walletDomainPort.getProgramWallet({
      coopname,
      username,
      program_id: getProgramId(ProgramType.BLAGOROST),
    });
    if (!wallet || !wallet.available || !wallet.blocked) return null;
    return this.sumShares(username, wallet.available, wallet.blocked);
  }

  /** Сумма доступного и заблокированного; несложимое — в журнал и пропуск. */
  sumShares(username: string, available: string, blocked: string): string | null {
    try {
      return AssetUtils.sumAssets([available, blocked]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Синхронизация regshare: не удалось сложить балансы кошелька ${username}: ${message}`);
      return null;
    }
  }

  private sameAssetAmount(a: string, b: string): boolean {
    const pa = AssetUtils.parseAsset(a);
    const pb = AssetUtils.parseAsset(b);
    if (pa.symbol !== pb.symbol) {
      return false;
    }
    return Math.abs(pa.amount - pb.amount) < 1e-9;
  }
}
