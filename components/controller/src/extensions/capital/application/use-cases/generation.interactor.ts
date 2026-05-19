import { Injectable, Inject, forwardRef, ConflictException } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { CreateCommitDomainInput } from '../../domain/actions/create-commit-domain-input.interface';
import type { CommitApproveDomainInput } from '../../domain/actions/commit-approve-domain-input.interface';
import type { CommitDeclineDomainInput } from '../../domain/actions/commit-decline-domain-input.interface';
import { TimeTrackingService } from '../services/time-tracking.service';
import { GitService } from '../services/git.service';
import { ContributorRepository, CONTRIBUTOR_REPOSITORY } from '../../domain/repositories/contributor.repository';
import { CommitRepository, COMMIT_REPOSITORY } from '../../domain/repositories/commit.repository';
import { CommitDomainEntity, type CommitContentData, type CommitData } from '../../domain/entities/commit.entity';
import type { CapitalContract } from 'cooptypes';
import { PermissionsService } from '../services/permissions.service';
import { CommitStatus } from '../../domain/enums/commit-status.enum';
import { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { randomUUID } from 'crypto';
import { sha256 } from '~/utils/sha256';
import { CommitSyncService } from '../syncers/commit-sync.service';
import { HOURS_FLOAT_EPSILON } from '../../domain/utils/hours-float';
import {
  ISSUE_LINKED_GIT_COMMIT_REPOSITORY,
  type IssueLinkedGitCommitRepository,
} from '../../domain/repositories/issue-linked-git-commit.repository';

/**
 * Интерактор домена для генерации в CAPITAL контракте
 * Обрабатывает действия связанные с коммитами и обновлением сегментов
 */
@Injectable()
export class GenerationInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    private readonly timeTrackingService: TimeTrackingService,
    private readonly gitService: GitService,
    @Inject(CONTRIBUTOR_REPOSITORY)
    private readonly contributorRepository: ContributorRepository,
    @Inject(COMMIT_REPOSITORY)
    private readonly commitRepository: CommitRepository,
    private readonly permissionsService: PermissionsService,
    @Inject(forwardRef(() => CommitSyncService))
    private readonly commitSyncService: CommitSyncService,
    @Inject(ISSUE_LINKED_GIT_COMMIT_REPOSITORY)
    private readonly issueLinkedGitCommitRepository: IssueLinkedGitCommitRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(GenerationInteractor.name);
  }

  /**
   * Создание коммита в CAPITAL контракте
   * Проверяет доступность указанного количества часов и фиксирует время
   * commit_hash: из Git diff, из привязанных GitHub-коммитов или из off-chain взноса без Git (nonce в meta)
   */
  async createCommit(data: CreateCommitDomainInput, _currentUser: MonoAccountDomainInterface): Promise<CommitDomainEntity> {
    // Получаем участника по username
    const contributor = await this.contributorRepository.findByUsernameAndCoopname(data.username, data.coopname);

    if (!contributor) {
      throw new Error(`Участник не найден: ${data.username} в кооперативе ${data.coopname}`);
    }

    // Ленивый ремонт: перед расчётом доступного времени приводим estimate-билеты
    // всех DONE-задач проекта к текущему составу creators. Идемпотентно — лечит
    // расхождения, оставшиеся после прежних операций (смена creators без смены estimate,
    // возврат задачи из DONE и обратно, удалённые билеты у сиротских задач).
    await this.timeTrackingService.recalcDoneEstimatesForContributorProject(
      contributor.contributor_hash,
      data.project_hash
    );

    // Получаем доступное время для коммита
    const availableHours = await this.timeTrackingService.getAvailableCommitHours(
      contributor.contributor_hash,
      data.project_hash
    );

    if (availableHours <= HOURS_FLOAT_EPSILON) {
      throw new Error('Нет доступного времени для коммита. Пожалуйста, сначала поработайте над завершенными задачами.');
    }

    // Проверяем что запрошенное количество часов не превышает доступное
    if (data.commit_hours > availableHours + HOURS_FLOAT_EPSILON) {
      throw new Error(
        `Запрошенное количество часов коммита (${data.commit_hours}) превышает доступное время (${availableHours}). ` +
          'Пожалуйста, уменьшите количество часов коммита или завершите больше задач.'
      );
    }

    // В блокчейн уходит только целое число полных часов; off-chain остаётся дробный хвост
    const chainHours = Math.floor(data.commit_hours + HOURS_FLOAT_EPSILON);
    if (chainHours < 1) {
      throw new Error(
        'Для коммита в блокчейн нужен минимум один полный час накопленного времени по завершённым задачам. ' +
          `Сейчас при запросе ${data.commit_hours} ч в цепь уходит 0 ч — дождитесь накопления целого часа или укажите большее значение.`
      );
    }
    const maxChainFromAvailable = Math.floor(availableHours + HOURS_FLOAT_EPSILON);
    if (chainHours > maxChainFromAvailable) {
      throw new Error(
        `Нельзя зафиксировать в блокчейне ${chainHours} ч: доступно не более ${maxChainFromAvailable} полных часов ` +
          `(${availableHours} ч суммарно).`
      );
    }

    // Обработка поля data и генерация commit_hash
    let commitHash = '';
    let enrichedData: CommitData | null = null;
    let metaData: Record<string, unknown> = {};
    let linkedRowIdsToConsume: string[] = [];

    // Парсим существующие мета-данные
    try {
      metaData = data.meta ? (JSON.parse(data.meta) as Record<string, unknown>) : {};
    } catch {
      this.logger.warn('Не удалось распарсить meta как JSON, используется как есть');
      metaData = {};
    }

    const linkedRows = await this.issueLinkedGitCommitRepository.findUnconsumedByProjectAndUsername(
      data.project_hash,
      data.username
    );

    const feedbackItems = this.extractValidatedContributionFeedback(data.data);

    const hasGitPayload =
      data.data &&
      Array.isArray(data.data) &&
      data.data.some((item) => item.type === 'git' && item.data?.url && this.gitService.isGitUrl(item.data.url));

    if (hasGitPayload) {
      enrichedData = [];
      const payload = data.data as NonNullable<CreateCommitDomainInput['data']>;

      for (const item of payload) {
        if (item.type === 'git' && item.data?.url && this.gitService.isGitUrl(item.data.url)) {
          try {
            // Извлекаем diff из Git-источника
            const gitDiffData = await this.gitService.extractDiffFromUrl(item.data.url);

            // Генерируем commit_hash на основе diff (только для первого Git элемента)
            if (!commitHash) {
              commitHash = sha256(gitDiffData.diff);
              // Добавляем URL в мета-данные для блокчейна
              metaData.git_url = gitDiffData.url;
              this.logger.debug(`Сгенерирован commit_hash: ${commitHash} на основе diff`);
            }

            // Добавляем обогащенные данные
            enrichedData.push({
              type: 'git',
              data: {
                source: gitDiffData.source,
                type: gitDiffData.type,
                url: gitDiffData.url,
                owner: gitDiffData.owner,
                repo: gitDiffData.repo,
                ref: gitDiffData.ref,
                diff: gitDiffData.diff,
                extracted_at: gitDiffData.extracted_at,
              },
            });

            this.logger.debug(`Обработан Git URL: ${item.data.url}`);
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Ошибка при обработке Git URL ${item.data.url}: ${msg}`, stack);
            throw new Error(`Не удалось обработать Git URL ${item.data.url}: ${msg}`);
          }
        } else if (item.type === 'contribution_feedback') {
          continue;
        } else {
          enrichedData.push(item);
        }
      }
      this.appendContributionFeedbackItems(enrichedData, feedbackItems);
    } else if (linkedRows.length > 0) {
      enrichedData = [];
      let combined = '';
      const extractedAt = new Date().toISOString();
      for (const row of linkedRows) {
        combined += `${row.diff_text}\n`;
        enrichedData.push({
          type: 'git',
          data: {
            source: 'github',
            type: 'commit',
            url: row.html_url,
            owner: row.github_owner,
            repo: row.github_repo,
            ref: row.github_sha,
            diff: row.diff_text,
            extracted_at: extractedAt,
          },
        });
      }
      commitHash = sha256(combined);
      metaData.git_linked_commits = linkedRows.map((r) => r.github_sha);
      linkedRowIdsToConsume = linkedRows.map((r) => r.id);
      this.logger.debug(`Сгенерирован commit_hash из ${linkedRows.length} привязанных GitHub-коммитов`);
      this.appendContributionFeedbackItems(enrichedData, feedbackItems);
    } else {
      enrichedData = [];
      this.appendContributionFeedbackItems(enrichedData, feedbackItems);
      const nonce = randomUUID();
      metaData.artifact_contribution_nonce = nonce;
      commitHash = sha256(
        JSON.stringify({
          kind: 'capital_contribution_artifact_v1',
          coopname: data.coopname,
          project_hash: String(data.project_hash).toLowerCase(),
          username: data.username,
          creator_hours: chainHours,
          nonce,
          feedback: feedbackItems,
        })
      );
      this.logger.debug('Сгенерирован commit_hash для взноса без Git (артефакт по задаче)');
    }

    // Проверяем, что commitHash был установлен
    if (!commitHash) {
      throw new Error('commitHash не был установлен - это внутренняя ошибка');
    }

    // Проверяем, существует ли уже коммит с таким хэшем
    const existingCommit = await this.commitRepository.findByCommitHash(commitHash);
    if (existingCommit) {
      this.logger.warn(`Коммит с хэшем ${commitHash} уже существует`);
      throw new ConflictException(`Коммит с хэшем ${commitHash} уже существует`);
    }

    // Создаём доменную сущность для валидации
    const commitEntity = new CommitDomainEntity({
      _id: '', // будет сгенерирован
      block_num: 0,
      present: false,
      commit_hash: commitHash,
      status: 'pending',
      blockchain_status: 'pending',
      data: enrichedData, // Обогащенные данные (будут сохранены только в БД)
    });

    // Создаём и валидируем сущность (без сохранения) и получаем TypeORM сущность
    const createdEntity = await this.commitRepository.create(commitEntity);

    // Создаём данные для блокчейна с указанным временем
    // ВАЖНО: data НЕ отправляется в блокчейн, только в БД
    const blockchainData: CapitalContract.Actions.CreateCommit.ICommit = {
      coopname: data.coopname,
      username: data.username,
      description: data.description,
      meta: JSON.stringify(metaData),
      project_hash: data.project_hash,
      commit_hash: commitHash,
      creator_hours: chainHours,
    };

    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.createCommit(blockchainData);

    this.logger.debug(`Транзакция выполнена успешно`);

    // Фиксируем указанное количество времени в коммите
    await this.timeTrackingService.commitTime(contributor.contributor_hash, data.project_hash, chainHours, commitHash);

    // Сохраняем сущность в базу данных после успешной транзакции
    await this.commitRepository.saveCreated(createdEntity);

    if (linkedRowIdsToConsume.length > 0) {
      await this.issueLinkedGitCommitRepository.markConsumed(linkedRowIdsToConsume, commitHash);
    }

    this.logger.debug(`Коммит сохранен в БД с hash: ${commitHash}`);

    // Синхронизируем коммит с блокчейном для получения полных данных (id, amounts и т.д.)
    const syncedCommit = await this.commitSyncService.syncCommit(data.coopname, commitHash, transactResult);

    if (!syncedCommit) {
      // Если синхронизация не удалась, возвращаем данные из БД
      this.logger.warn(`Не удалось синхронизировать коммит ${commitHash} с блокчейном, возвращаем данные из БД`);

      const savedCommit = await this.commitRepository.findByCommitHash(commitHash);
      if (!savedCommit) {
        throw new Error(`Не удалось найти созданный коммит с hash: ${commitHash}`);
      }
      return savedCommit;
    }

    this.logger.debug(`Коммит ${commitHash} успешно синхронизирован с блокчейном`);

    return syncedCommit;
  }

  /**
   * Одобрение коммита в CAPITAL контракте
   */
  async approveCommit(data: CommitApproveDomainInput): Promise<CommitDomainEntity> {
    // Получаем коммит для проверки прав доступа
    const commit = await this.commitRepository.findByCommitHash(data.commit_hash);
    if (!commit) {
      throw new Error(`Коммит с хешем ${data.commit_hash} не найден`);
    }

    if (!commit.project_hash) {
      throw new Error('Коммит не связан с проектом');
    }

    // Проверяем, что текущий пользователь является мастером проекта или компонента
    const isMaster = await this.permissionsService.isProjectOrComponentMaster(data.master, commit.project_hash);
    if (!isMaster) {
      throw new Error('У вас нет прав для одобрения этого коммита. Только мастер проекта может одобрять коммиты.');
    }

    // Создаём данные для блокчейна
    const blockchainData: CapitalContract.Actions.CommitApprove.ICommitApprove = {
      coopname: data.coopname,
      master: data.master,
      commit_hash: data.commit_hash,
    };

    // Вызываем блокчейн порт
    await this.capitalBlockchainPort.approveCommit(blockchainData);

    // Обновляем статус в базе данных
    commit.status = CommitStatus.APPROVED;

    // Не сохраняем в базу данных, так как статус будет обновлен через блокчейн

    // Возвращаем обновленный коммит
    return commit;
  }

  /**
   * Отклонение коммита в CAPITAL контракте
   */
  async declineCommit(data: CommitDeclineDomainInput): Promise<CommitDomainEntity> {
    // Получаем коммит для проверки прав доступа
    const commit = await this.commitRepository.findByCommitHash(data.commit_hash);
    if (!commit) {
      throw new Error(`Коммит с хешем ${data.commit_hash} не найден`);
    }

    if (!commit.project_hash) {
      throw new Error('Коммит не связан с проектом');
    }

    // Проверяем, что текущий пользователь является мастером проекта или компонента
    const isMaster = await this.permissionsService.isProjectOrComponentMaster(data.master, commit.project_hash);
    if (!isMaster) {
      throw new Error('У вас нет прав для отклонения этого коммита. Только мастер проекта может отклонять коммиты.');
    }

    // Обновляем статус в базе данных
    commit.status = CommitStatus.DECLINED;
    await this.commitRepository.save(commit);

    // Откатываем time-entries обратно в uncommitted и нормализуем раскладку долей
    // по затронутым DONE-задачам. Иначе часы остаются в total_committed_hours и
    // не возвращаются в доступный пул.
    await this.timeTrackingService.revertEntriesForDeclinedCommit(data.commit_hash);

    // Создаём данные для блокчейна
    const blockchainData: CapitalContract.Actions.CommitDecline.ICommitDecline = {
      coopname: data.coopname,
      master: data.master,
      commit_hash: data.commit_hash,
      reason: data.reason,
    };

    // Вызываем блокчейн порт
    await this.capitalBlockchainPort.declineCommit(blockchainData);

    // Возвращаем обновленный коммит
    return commit;
  }

  /**
   * Обработать одобрение коммита из блокчейна
   */
  async handleApproveCommit(actionData: ActionDomainInterface): Promise<void> {
    try {
      const { data, block_num } = actionData;
      const actionPayload = data as CapitalContract.Actions.CommitApprove.ICommitApprove;

      this.logger.debug(`Обработка одобрения коммита ${actionPayload.commit_hash} в блоке ${block_num}`);

      // Найти коммит по commit_hash
      const commit = await this.commitRepository.findByCommitHash(actionPayload.commit_hash);

      if (!commit) {
        this.logger.warn(`Коммит ${actionPayload.commit_hash} не найден для одобрения`);
        return;
      }

      // Обновить статус и блок
      commit.status = CommitStatus.APPROVED;
      commit.block_num = block_num;

      // Сохранить изменения
      await this.commitRepository.save(commit);

      this.logger.debug(`Коммит ${actionPayload.commit_hash} одобрен`);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке одобрения коммита: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Обработать отклонение коммита из блокчейна
   */
  async handleDeclineCommit(actionData: ActionDomainInterface): Promise<void> {
    try {
      const { data, block_num } = actionData;
      const actionPayload = data as CapitalContract.Actions.CommitDecline.ICommitDecline;

      this.logger.debug(`Обработка отклонения коммита ${actionPayload.commit_hash} в блоке ${block_num}`);

      // Найти коммит по commit_hash
      const commit = await this.commitRepository.findByCommitHash(actionPayload.commit_hash);

      if (!commit) {
        this.logger.warn(`Коммит ${actionPayload.commit_hash} не найден для отклонения`);
        return;
      }

      // Обновить статус и блок
      commit.status = CommitStatus.DECLINED;
      commit.block_num = block_num;

      // Сохранить изменения
      await this.commitRepository.save(commit);

      // Откатить time-entries и нормализовать раскладку (идемпотентно: если decline
      // уже был обработан через локальный путь, revert вернёт 0 затронутых).
      await this.timeTrackingService.revertEntriesForDeclinedCommit(actionPayload.commit_hash);

      this.logger.debug(`Коммит ${actionPayload.commit_hash} отклонен`);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке отклонения коммита: ${error?.message}`, error?.stack);
    }
  }

  private extractValidatedContributionFeedback(payload?: CommitData): CommitContentData[] {
    if (!payload?.length) return [];
    const out: CommitContentData[] = [];
    for (const item of payload) {
      if (item.type !== 'contribution_feedback') continue;
      const stars = Number(item.data?.satisfaction_stars);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) continue;
      const reviewText = typeof item.data?.review_text === 'string' ? item.data.review_text : '';
      if (reviewText.length > 8000) continue;
      out.push({
        type: 'contribution_feedback',
        data: { satisfaction_stars: stars, review_text: reviewText },
      });
    }
    return out;
  }

  private appendContributionFeedbackItems(target: CommitData, items: CommitContentData[]): void {
    for (const it of items) {
      target.push(it);
    }
  }
}
