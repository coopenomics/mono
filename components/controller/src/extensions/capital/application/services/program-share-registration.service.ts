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
import { WALLET_DOMAIN_PORT, type WalletDomainPort } from '~/domain/wallet/ports/wallet-domain.port';
import { getProgramId, ProgramType } from '~/domain/wallet/enums/program-type.enum';
import { AssetUtils } from '~/shared/utils/asset.utils';
import { HttpApiError } from '~/utils/httpApiError';

const REGSHARE_TX_GAP_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
    @Inject(WALLET_DOMAIN_PORT)
    private readonly walletDomainPort: WalletDomainPort
  ) {}

  /**
   * Обход участников в статусах active/import по active-проектам; при изменении user_shares относительно capital_contributor_shares — regshare.
   */
  async syncProgramSharesForCoop(coopname: string): Promise<void> {
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
  async syncProgramSharesForUser(coopname: string, username: string): Promise<void> {
    const projects = await this.findActiveProjects(coopname);
    if (projects.length === 0) return;

    const contributor = (await this.contributorRepository.findAll()).find(
      (c) =>
        c.coopname === coopname &&
        c.username === username &&
        (c.status === ContributorStatus.ACTIVE || c.status === ContributorStatus.IMPORT)
    );
    if (!contributor) return;

    await this.syncContributor(coopname, contributor, projects.map((p) => p.project_hash));
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
    return (await this.projectRepository.findAll()).filter(
      (p) => p.coopname === coopname && p.status === ProjectStatus.ACTIVE
    );
  }

  private async syncContributor(
    coopname: string,
    contributor: ContributorDomainEntity,
    projectHashes: string[]
  ): Promise<void> {
    const programId = getProgramId(ProgramType.BLAGOROST);

    const wallet = await this.walletDomainPort.getProgramWallet({
      coopname,
      username: contributor.username,
      program_id: programId,
    });

    if (!wallet || !wallet.available || !wallet.blocked) return;

    let targetShares: string;
    try {
      targetShares = AssetUtils.sumAssets([wallet.available, wallet.blocked]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Синхронизация regshare: не удалось сложить балансы кошелька ${contributor.username}: ${message}`
      );
      return;
    }

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
        await delay(REGSHARE_TX_GAP_MS);
      } catch (error: unknown) {
        const message = error instanceof HttpApiError ? error.message : error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.warn(
          `regshare не выполнен: coop=${coopname} project=${projectHash} user=${contributor.username}: ${message}`,
          stack
        );
      }
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
