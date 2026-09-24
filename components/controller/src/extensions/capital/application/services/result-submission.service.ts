import { Injectable, Inject } from '@nestjs/common';
import { ResultSubmissionInteractor } from '../use-cases/result-submission.interactor';
import type { IMonoAccount } from '@coopenomics/innercoop';
import type { PushResultInputDTO } from '../dto/result_submission/push-result-input.dto';
import type { ConvertSegmentInputDTO } from '../dto/result_submission/convert-segment-input.dto';
import type { SignActAsContributorInputDTO } from '../dto/result_submission/sign-act-as-contributor-input.dto';
import type { SignActAsChairmanInputDTO } from '../dto/result_submission/sign-act-as-chairman-input.dto';
import { ResultOutputDTO } from '../dto/result_submission/result.dto';
import { ResultFilterInputDTO } from '../dto/result_submission/result-filter.input';
import { PaginationInputDTO, PaginationResult, GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO, platformSettings, DomainError } from '@coopenomics/extension-kit';
import { ResultContributionStatementGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-statement-input.dto';
import { ResultContributionDecisionGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-decision-input.dto';
import { ResultContributionActGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-act-input.dto';
import { ResultContributionStatementGenerateDocumentInputDTO } from '../documents-dto/result-contribution-statement-document.dto';
import { ResultContributionDecisionGenerateDocumentInputDTO } from '../documents-dto/result-contribution-decision-document.dto';
import { ResultContributionActGenerateDocumentInputDTO } from '../documents-dto/result-contribution-act-document.dto';
import { Cooperative } from 'cooptypes';
import { Classes } from '@coopenomics/sdk';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';
import { SegmentMapper } from '../../infrastructure/mappers/segment.mapper';
import { ResultMapper } from '../../infrastructure/mappers/result.mapper';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { COMMIT_REPOSITORY, CommitRepository } from '../../domain/repositories/commit.repository';
import {
  ISSUE_LINKED_GIT_COMMIT_REPOSITORY,
  type IssueLinkedGitCommitRepository,
} from '../../domain/repositories/issue-linked-git-commit.repository';
import { RESULT_REPOSITORY, ResultRepository } from '../../domain/repositories/result.repository';
import { SEGMENT_REPOSITORY, SegmentRepository } from '../../domain/repositories/segment.repository';
import { ResultStatus } from '../../domain/enums/result-status.enum';
import { ResultDomainEntity } from '../../domain/entities/result.entity';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { SegmentDomainEntity } from '../../domain/entities/segment.entity';
import {
  CommitDomainEntity,
  type ICommitGitData,
} from '../../domain/entities/commit.entity';
import { STORY_REPOSITORY, StoryRepository } from '../../domain/repositories/story.repository';
import { ISSUE_REPOSITORY, IssueRepository } from '../../domain/repositories/issue.repository';
import { StoryContentFormat } from '../../domain/enums/story-content-format.enum';
import type { IResultDatabaseData } from '../../domain/interfaces/result-database.interface';
import { createHash } from 'crypto';
import {
  RESULT_DOCUMENT_PAYLOAD_VERSION,
  type ResultDocumentPayloadV2,
} from '../../domain/result-document-payload';
import { LOGGER_PORT, type ILoggerPort, DOCUMENT_PORT, type IDocumentPort } from '@coopenomics/innercoop';
import { t as i18nT } from '../../i18n';
/**
 * Сервис уровня приложения для подачи результатов в CAPITAL
 * Обрабатывает запросы от ResultSubmissionResolver
 */
@Injectable()
export class ResultSubmissionService {
  constructor(
    private readonly resultSubmissionInteractor: ResultSubmissionInteractor,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    private readonly segmentMapper: SegmentMapper,
    private readonly resultMapper: ResultMapper,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(COMMIT_REPOSITORY)
    private readonly commitRepository: CommitRepository,
    @Inject(ISSUE_LINKED_GIT_COMMIT_REPOSITORY)
    private readonly issueLinkedGitCommitRepository: IssueLinkedGitCommitRepository,
    @Inject(RESULT_REPOSITORY)
    private readonly resultRepository: ResultRepository,
    @Inject(SEGMENT_REPOSITORY)
    private readonly segmentRepository: SegmentRepository,
    @Inject(STORY_REPOSITORY)
    private readonly storyRepository: StoryRepository,
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(ResultSubmissionService.name);
  }

  /**
   * Внесение результата в CAPITAL контракте
   */
  async pushResult(data: PushResultInputDTO, currentUser: IMonoAccount): Promise<SegmentOutputDTO> {
    // Проверяем, что пользователь может вносить результаты только для себя
    if (data.username !== currentUser.username) {
      throw DomainError.internal('CAPITAL_RESULT_SUBMIT_FOR_SELF_ONLY');
    }

    // Находим существующий Result по project_hash и username
    const result = await this.resultRepository.findByProjectHashAndUsername(data.project_hash, data.username);
    if (!result || !result.result_hash) {
      throw DomainError.internal('CAPITAL_RESULT_NOT_FOUND_FOR_PROJECT_USER', { projectHash: data.project_hash, username: data.username });
    }

    // Получаем сгенерированный документ из репозитория по doc_hash
    const generatedDocument = await this.documentPort.getByHash(data.statement.doc_hash);
    if (!generatedDocument) {
      throw DomainError.internal('CAPITAL_GENERATED_DOCUMENT_NOT_FOUND', { hash: data.statement.doc_hash });
    }

    // Выполняем глубокую сверку подписанного и сгенерированного документов через SDK
    const comparison = await Classes.Document.compareDocuments(
      data.statement as any,
      generatedDocument as any
    );

    if (!comparison.isValid) {
      const differences = Object.entries(comparison.differences)
        .map(([field, values]) => i18nT('capital.resultSubmission.mismatchLine', { field, expected: values.expected, actual: values.actual }))
        .join('; ');
      throw DomainError.internal('CAPITAL_DOCUMENT_VERIFICATION_MISMATCH', { differences });
    }

    this.logger.info(`Глубокая сверка документов успешна для результата ${result.result_hash}`);

    this.assertStatementMatchesResultHash(generatedDocument, result.result_hash);

    // Находим сегмент пользователя по проекту
    const segment = await this.segmentRepository.findOne({
      project_hash: data.project_hash,
      username: data.username,
    });

    if (!segment) {
      throw DomainError.internal('CAPITAL_SEGMENT_NOT_FOUND', { username: data.username, projectHash: data.project_hash });
    }

    // Суммы живут в блокчейн-части сегмента. Если её нет, сегмент не
    // синхронизирован с цепью, и подставлять '0' нельзя: это не валидный ассет
    // (нет дробной части и символа) — запрос упал бы на разборе ABI, а не с
    // внятным отказом. Отсекаем здесь.
    if (!segment.intellectual_cost || !segment.debt_amount) {
      throw DomainError.internal('CAPITAL_SEGMENT_NOT_SYNCED', { username: data.username, projectHash: data.project_hash });
    }

    // Формируем данные для domain layer
    // Используем присланный подписанный документ (он прошел глубокую проверку)
    const domainInput = {
      coopname: platformSettings().coopname,
      username: data.username,
      project_hash: data.project_hash,
      result_hash: result.result_hash,
      contribution_amount: segment.intellectual_cost, // берем из сегмента
      debt_amount: segment.debt_amount, // берем из сегмента
      statement: data.statement,
      debt_hashes: [], // пока пустой массив
    };

    const segmentEntity = await this.resultSubmissionInteractor.pushResult(domainInput);

    // Здесь эмиттилось событие `result.updated` «для синхронизации с GitHub».
    // Слушателя у него не было ни одного: legacy markdown-синхронизация
    // проектов и результатов с GitHub удалена (см. GitHubSyncSchedulerService).
    // Событие снято вместе с перечитыванием результата, которое делалось
    // только ради него.
    return await this.segmentMapper.toDTO(segmentEntity);
  }

  /**
   * Заявление сгенерировано от конкретного result_hash (лежит в meta документа).
   * Если документ результата пересобрался после генерации заявления (пришли новые
   * коммиты и сегмент обновили), в цепь ушёл бы хэш, которого нет в подписанном
   * заявлении, — связка документов разорвалась бы. Отказываем с просьбой перегенерировать.
   */
  private assertStatementMatchesResultHash(generatedDocument: { meta?: Record<string, any> }, resultHash: string): void {
    const statementResultHash =
      typeof generatedDocument.meta?.result_hash === 'string' ? generatedDocument.meta.result_hash.toLowerCase() : null;
    if (statementResultHash && statementResultHash !== resultHash.toLowerCase()) {
      throw DomainError.internal('CAPITAL_RESULT_CHANGED_AFTER_STATEMENT');
    }
  }

  /**
   * Конвертация сегмента в CAPITAL контракте
   */
  async convertSegment(data: ConvertSegmentInputDTO, currentUser: IMonoAccount): Promise<SegmentOutputDTO> {
    const segmentEntity = await this.resultSubmissionInteractor.convertSegment(data, currentUser);
    return await this.segmentMapper.toDTO(segmentEntity);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех результатов с фильтрацией
   */
  async getResults(filter?: ResultFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<ResultOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDTO | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.resultSubmissionInteractor.getResults(filter, domainOptions);

    // Конвертируем результат в DTO с обогащением документов
    const items = await Promise.all(result.items.map((item) => this.resultMapper.toDTO(item)));

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение результата по ID
   */
  async getResultById(_id: string): Promise<ResultOutputDTO | null> {
    const result = await this.resultSubmissionInteractor.getResultById(_id);
    return result ? await this.resultMapper.toDTO(result) : null;
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** HTML одного git-диффа (как раньше в документе результата). */
  private renderGitDiffHtml(gitData: ICommitGitData): string {
    const htmlParts: string[] = [];
    htmlParts.push(
      `<p><a class="commit-url" href="${gitData.url}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(gitData.url)}</a> (${this.escapeHtml(String(gitData.type))})</p>`
    );
    if (!gitData.diff) {
      return htmlParts.join('\n');
    }
    htmlParts.push('<div class="diff-container">');
    const diffLines = gitData.diff.split('\n');
    diffLines.forEach((line) => {
      const escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (line.startsWith('diff --git')) {
        htmlParts.push(`<div class="diff-header">${escapedLine}</div>`);
      } else if (
        line.startsWith('index ') ||
        line.startsWith('new file') ||
        line.startsWith('deleted file') ||
        line.startsWith('---') ||
        line.startsWith('+++')
      ) {
        htmlParts.push(`<div class="diff-meta">${escapedLine}</div>`);
      } else if (line.startsWith('@@')) {
        htmlParts.push(`<div class="diff-hunk">${escapedLine}</div>`);
      } else if (line.startsWith('+')) {
        htmlParts.push(`<div class="diff-add">${escapedLine}</div>`);
      } else if (line.startsWith('-')) {
        htmlParts.push(`<div class="diff-del">${escapedLine}</div>`);
      } else {
        htmlParts.push(`<div class="diff-normal">${escapedLine}</div>`);
      }
    });
    htmlParts.push('</div>');
    return htmlParts.join('\n');
  }

  private static readonly STORY_XML_EXCERPT_MAX = 12_000;

  private fencedMarkdownCodeBlock(info: string, body: string): string {
    if (body.includes('```')) {
      return `~~~${info}\n${body}\n~~~`;
    }
    return `\`\`\`${info}\n${body}\n\`\`\``;
  }

  private indentMarkdownBlock(text: string, spaces: number): string {
    const pad = ' '.repeat(spaces);
    return text
      .split('\n')
      .map((line) => (line.length > 0 ? pad + line : line))
      .join('\n');
  }

  /** Тело требования в Markdown (сырой markdown / fenced XML / mermaid). */
  private storyDescriptionToResultMarkdown(
    description: string | undefined,
    format: StoryContentFormat
  ): string {
    if (!description || description === '{}') {
      return '';
    }
    switch (format) {
      case StoryContentFormat.BPMN:
      case StoryContentFormat.DRAWIO: {
        const excerpt =
          description.length > ResultSubmissionService.STORY_XML_EXCERPT_MAX
            ? `${description.slice(0, ResultSubmissionService.STORY_XML_EXCERPT_MAX)}\n\n…`
            : description;
        const label =
          format === StoryContentFormat.BPMN
            ? i18nT('capital.resultSubmission.diagramBpmnLabel')
            : i18nT('capital.resultSubmission.diagramDrawioLabel');
        return `*${label}*\n\n${this.fencedMarkdownCodeBlock('xml', excerpt)}`;
      }
      case StoryContentFormat.MERMAID:
        return i18nT('capital.resultSubmission.diagramMermaidLabel', { content: this.fencedMarkdownCodeBlock('mermaid', description) });
      case StoryContentFormat.MARKDOWN:
      default:
        return description;
    }
  }

  /**
   * Публичный метод для генерации текста результата
   * Вызывается при обновлении сегмента
   */
  /** Статусы, при которых документ результата можно пересобрать: результат ещё не отправлен в цепь, отклонён либо цикл приёмки завершён. */
  private static readonly RESULT_REGENERATION_ALLOWED_STATUSES: readonly ResultStatus[] = [
    ResultStatus.PENDING,
    ResultStatus.DECLINED,
    ResultStatus.ACT2,
  ];

  async generateResultData(
    projectHash: string,
    username: string
  ): Promise<ResultDomainEntity> {
    // Хэш результата фиксируется подписанным заявлением и уходит в блокчейн:
    // пока результат идёт по приёмке, пересборка документа изменила бы
    // result_hash и разорвала связку с уже подписанными документами.
    const existingResult = await this.resultRepository.findByProjectHashAndUsername(projectHash, username);
    if (
      existingResult &&
      !ResultSubmissionService.RESULT_REGENERATION_ALLOWED_STATUSES.includes(existingResult.status)
    ) {
      this.logger.warn(
        `Результат ${existingResult.result_hash} (${projectHash}/${username}) идёт по приёмке (статус ${existingResult.status}) — документ не пересобирается, хэш сохранён`
      );
      return existingResult;
    }

    // Находим проект
    const project = await this.projectRepository.findByHash(projectHash);
    if (!project) {
      throw DomainError.internal('CAPITAL_PROJECT_NOT_FOUND_BY_HASH', { hash: projectHash });
    }

    // Находим родительский проект
    const parentProject = project.parent_hash
      ? await this.projectRepository.findByHash(project.parent_hash)
      : null;

    // Находим сегмент
    const segment = await this.segmentRepository.findOne({
      project_hash: projectHash,
      username: username,
    });

    if (!segment) {
      throw DomainError.internal('CAPITAL_SEGMENT_NOT_FOUND', { username, projectHash });
    }

    // Находим все коммиты
    const allCommits = await this.commitRepository.findByProjectHash(projectHash);
    const commits = allCommits.filter(commit => commit.username === username);

    // Генерируем текст результата
    const resultContributionDocument = await this.generateCombinedData(
      project,
      segment,
      commits,
      parentProject
    );

    // Вычисляем хеш результата
    const result_hash = createHash('sha256').update(resultContributionDocument).digest('hex');

    // Result уже перечитан гардом выше — работаем с ним
    let resultEntity = existingResult;

    if (resultEntity) {
      // Обновляем существующий Result
      resultEntity.data = resultContributionDocument;
      resultEntity.result_hash = result_hash;
      resultEntity = await this.resultRepository.update(resultEntity);
    } else {
      // Создаем новый Result
      const resultDatabaseData: IResultDatabaseData = {
        _id: '', // будет сгенерировано
        result_hash,
        project_hash: projectHash,
        coopname: platformSettings().coopname,
        username: username,
        status: ResultStatus.PENDING,
        block_num: undefined,
        present: false,
        data: resultContributionDocument,
      };

      resultEntity = new ResultDomainEntity(resultDatabaseData);
      resultEntity = await this.resultRepository.create(resultEntity);
    }

    return resultEntity;
  }

  /**
   * Формирование данных результата: Markdown (ТЗ, задачи) + HTML только для диффов коммитов.
   * В БД сохраняется JSON (см. ResultDocumentPayloadV2).
   */
  private async generateCombinedData(
    project: ProjectDomainEntity,
    segment: SegmentDomainEntity,
    commits: CommitDomainEntity[],
    parentProject?: ProjectDomainEntity | null
  ): Promise<string> {
    const mdParts: string[] = [];
    const diffHtmlBlocks: string[] = [];

    const parentProjectTitle = parentProject?.title || '';
    const componentTitle = project.title || '';
    const fullTitle = (parentProjectTitle ? `${parentProjectTitle}. ${componentTitle}` : componentTitle).replace(
      /\s+/g,
      ' '
    );
    mdParts.push(`# ${fullTitle.trim()}`);

    if (segment.is_author || segment.is_coordinator || segment.is_contributor) {
      // mdParts.push('## Техническое задание');

      if (project.description) {
        mdParts.push(project.description);
      }

      const projectStories = await this.storyRepository.findProjectStories(project.project_hash);
      if (projectStories.length > 0) {
        const storyLines: string[] = [];
        for (const story of projectStories) {
          storyLines.push(`**${story.title}**`);
          if (story.description && story.description !== '{}') {
            const storyMd = this.storyDescriptionToResultMarkdown(story.description, story.content_format);
            if (storyMd) {
              storyLines.push('');
              storyLines.push(this.indentMarkdownBlock(storyMd, 2));
            }
          }
        }
        mdParts.push(storyLines.join('\n'));
      }

      const projectIssues = await this.issueRepository.findByProjectHash(project.project_hash);
      for (const issue of projectIssues) {
        mdParts.push(`### ${issue.title}`);
        if (issue.description) {
          mdParts.push(issue.description);
        }
        const issueStories = await this.storyRepository.findByIssueHash(issue.issue_hash);
        if (issueStories.length > 0) {
          mdParts.push(i18nT('capital.resultSubmission.artifactsHeading'));
          const reqLines: string[] = [];
          for (const story of issueStories) {
            reqLines.push(`**${story.title}**`);
            if (story.description && story.description !== '{}') {
              const storyMd = this.storyDescriptionToResultMarkdown(story.description, story.content_format);
              if (storyMd) {
                reqLines.push('');
                reqLines.push(this.indentMarkdownBlock(storyMd, 2));
              }
            }
          }
          mdParts.push(reqLines.join('\n'));
        }
        mdParts.push('');
      }
    }

    if (segment.is_creator) {
      mdParts.push(i18nT('capital.resultSubmission.executedHeading'));

      const completedIssues = await this.issueRepository.findCompletedByProjectAndCreators(
        project.project_hash,
        [segment.username as string]
      );

      if (completedIssues.length > 0) {
        mdParts.push(completedIssues.map((issue) => `- ${issue.title}`).join('\n'));
      }

      if (commits.length > 0) {
        mdParts.push(i18nT('capital.resultSubmission.executionHeading'));

        for (const commit of commits) {
          if (!commit.data?.length) {
            continue;
          }
          for (const content of commit.data) {
            switch (content.type) {
              case 'git': {
                const gitData = content.data as ICommitGitData;
                diffHtmlBlocks.push(`<div class="commit-content">\n${this.renderGitDiffHtml(gitData)}\n</div>`);
                break;
              }
              // Оценка и отзыв — только на коммите для приёмки мастером, не в юридический РИД
              case 'contribution_feedback':
                break;
              case 'committed_issues': {
                const issues = (content.data as { issues?: Array<{ title?: string; issue_hash?: string }> })?.issues;
                if (issues?.length) {
                  const items = issues
                    .map((issue) => {
                      const title = this.escapeHtml(issue.title?.trim() || issue.issue_hash || i18nT('capital.resultSubmission.issueLabel'));
                      return `<li>${title}</li>`;
                    })
                    .join('');
                  diffHtmlBlocks.push(
                    i18nT('capital.resultSubmission.issuesListBlock', { items })
                  );
                }
                break;
              }
              default: {
                const t = this.escapeHtml(String((content as { type?: string }).type ?? '?'));
                diffHtmlBlocks.push(i18nT('capital.resultSubmission.unknownContentBlock', { type: t }));
              }
            }
          }
        }

        const linkedGit = await this.issueLinkedGitCommitRepository.findUnconsumedByProjectAndUsername(
          project.project_hash,
          String(segment.username)
        );
        for (const row of linkedGit) {
          diffHtmlBlocks.push(
            `<div class="commit-content">\n${this.renderGitDiffHtml({
              source: 'github',
              type: 'commit',
              url: row.html_url,
              owner: row.github_owner,
              repo: row.github_repo,
              ref: row.github_sha,
              diff: row.diff_text,
              extracted_at: row.committed_at.toISOString(),
            })}\n</div>`
          );
        }
      }
    }

    const payload: ResultDocumentPayloadV2 = {
      v: RESULT_DOCUMENT_PAYLOAD_VERSION,
      meta: {
        contributor: String(segment.username),
        project_hash: project.project_hash,
      },
      markdown: mdParts.filter((s) => s.trim().length > 0).join('\n\n'),
      diffHtmlBlocks,
    };

    return JSON.stringify(payload);
  }

  /**
   * Генерация заявления о вкладе результатов
   * Использует уже сгенерированный текст результата из базы данных
   * Документ автоматически сохраняется в репозитории документов
   */
  async generateResultContributionStatement(
    data: ResultContributionStatementGenerateInputDTO,
    options: GenerateDocumentOptionsInputDTO,
    currentUser: IMonoAccount
  ): Promise<GeneratedDocumentDTO> {
    // Проверяем, что пользователь может генерировать документы только для себя
    if (data.username !== currentUser.username) {
      throw DomainError.internal('CAPITAL_DOCUMENT_GENERATION_FOR_SELF_ONLY');
    }

    // Находим существующий Result для данного пользователя и проекта
    const resultEntity = await this.resultRepository.findByProjectHashAndUsername(
      data.project_hash,
      currentUser.username
    );

    if (!resultEntity || !resultEntity.data) {
      throw DomainError.internal('CAPITAL_RESULT_TEXT_MISSING', { projectHash: data.project_hash });
    }

    // Находим проект по project_hash
    const project = await this.projectRepository.findByHash(data.project_hash);
    if (!project) {
      throw DomainError.internal('CAPITAL_PROJECT_NOT_FOUND_BY_HASH', { hash: data.project_hash });
    }

    // Находим родительский проект по parent_hash
    const parentProject = project.parent_hash
      ? await this.projectRepository.findByHash(project.parent_hash)
      : null;

    // Находим сегмент для данного пользователя и проекта
    const segment = await this.segmentRepository.findOne({
      project_hash: data.project_hash,
      username: currentUser.username,
    });

    if (!segment) {
      throw DomainError.internal('CAPITAL_SEGMENT_NOT_FOUND', { username: currentUser.username, projectHash: data.project_hash });
    }

    // Извлекаем данные
    const coopname = platformSettings().coopname;
    const username = currentUser.username;

    if (!project.title) {
      throw DomainError.internal('CAPITAL_COMPONENT_TITLE_MISSING');
    }
    // component_name - название текущего проекта
    const component_name = project.title;

    // project_name - название родительского проекта
    if (!parentProject?.title) {
      throw DomainError.internal('CAPITAL_PROJECT_TITLE_MISSING');
    }
    const project_name = parentProject.title;

    if (!segment.intellectual_cost) {
      throw DomainError.internal('CAPITAL_SEGMENT_AMOUNT_MISSING');
    }
    // total_amount - из сегмента поле intellectual_cost
    const total_amount = segment.intellectual_cost;

    // percent_of_result - рассчитываем как процент от fact.total_amount с округлением
    if (!project.fact?.total) {
      throw DomainError.internal('CAPITAL_PROJECT_AMOUNT_MISSING');
    }

    const factTotalAmount = parseFloat(project.fact.total);
    if (factTotalAmount <= 0) {
      throw DomainError.internal('CAPITAL_PROJECT_AMOUNT_NOT_POSITIVE');
    }

    if (!segment.share_percent) {
      throw DomainError.internal('CAPITAL_RESULT_SHARE_PERCENT_MISSING');
    }
    const percent_of_result = (segment.share_percent).toFixed(8);

    // Используем уже существующий result_hash из базы данных
    const result_hash = resultEntity.result_hash;

    // Подготавливаем данные для генерации документа
    const documentData: ResultContributionStatementGenerateDocumentInputDTO = {
      coopname,
      username,
      project_name,
      component_name,
      result_hash,
      percent_of_result,
      total_amount,
      registry_id: Cooperative.Registry.ResultContributionStatement.registry_id,
      lang: options?.lang as any,
    };

    const document = await this.documentPort.generate({
      data: documentData,
      options,
    });

    // Документ автоматически сохраняется в репозитории документов
    // и будет доступен для последующей сверки по doc_hash

    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация решения о вкладе результатов
   */
  async generateResultContributionDecision(
    data: ResultContributionDecisionGenerateInputDTO,
    options: GenerateDocumentOptionsInputDTO,
    _currentUser: IMonoAccount
  ): Promise<GeneratedDocumentDTO> {

    // Находим результат по result_hash
    const result = await this.resultRepository.findByResultHash(data.result_hash);
    if (!result) {
      throw DomainError.internal('CAPITAL_RESULT_NOT_FOUND', { hash: data.result_hash });
    }

    // Находим заявление по result_hash (должно быть в блокчейн данных)
    if (!result.statement) {
      throw DomainError.internal('CAPITAL_RESULT_STATEMENT_MISSING');
    }

    // Извлекаем данные из заявления
    const statementMeta = result.statement.meta;
    if (!statementMeta) {
      throw DomainError.internal('CAPITAL_STATEMENT_META_MISSING');
    }

    // Сверяем данные с текущими данными проекта и сегмента
    if (!result.project_hash) {
      throw DomainError.internal('CAPITAL_RESULT_PROJECT_HASH_MISSING');
    }
    const project = await this.projectRepository.findByHash(result.project_hash);
    if (!project) {
      throw DomainError.internal('CAPITAL_PROJECT_NOT_FOUND_BY_HASH', { hash: result.project_hash });
    }

    // Находим родительский проект
    const parentProject = project.parent_hash
      ? await this.projectRepository.findByHash(project.parent_hash)
      : null;

    // Находим сегмент
    if (!result.username) {
      throw DomainError.internal('CAPITAL_RESULT_USERNAME_MISSING');
    }
    const segment = await this.segmentRepository.findOne({
      project_hash: result.project_hash,
      username: result.username,
    });

    if (!segment) {
      throw DomainError.internal('CAPITAL_SEGMENT_NOT_FOUND', { username: result.username, projectHash: result.project_hash });
    }

    // Сверяем данные из заявления с текущими данными
    if (!project.title) {
      throw DomainError.internal('CAPITAL_COMPONENT_PROJECT_TITLE_MISSING');
    }
    const expectedComponentName = project.title;

    if (!parentProject?.title) {
      throw DomainError.internal('CAPITAL_PARENT_PROJECT_TITLE_MISSING');
    }
    const expectedProjectName = parentProject.title;

    if (!segment.intellectual_cost) {
      throw DomainError.internal('CAPITAL_SEGMENT_INTELLECTUAL_COST_MISSING');
    }
    const expectedTotalAmount = segment.intellectual_cost;

    if (!project.fact?.total) {
      throw DomainError.internal('CAPITAL_PROJECT_FACT_TOTAL_MISSING');
    }

    if (!segment.share_percent) {
      throw DomainError.internal('CAPITAL_RESULT_SHARE_PERCENT_MISSING');
    }
    const expectedPercentOfResult = (segment.share_percent).toFixed(8);

    // Сверка данных
    if (statementMeta.component_name !== expectedComponentName) {
      throw DomainError.internal('CAPITAL_COMPONENT_NAME_MISMATCH', { expected: expectedComponentName, actual: statementMeta.component_name });
    }

    if (statementMeta.project_name !== expectedProjectName) {
      throw DomainError.internal('CAPITAL_PROJECT_NAME_MISMATCH', { expected: expectedProjectName, actual: statementMeta.project_name });
    }

    if (statementMeta.total_amount !== expectedTotalAmount) {
      throw DomainError.internal('CAPITAL_TOTAL_AMOUNT_MISMATCH', { expected: expectedTotalAmount, actual: statementMeta.total_amount });
    }

    if (statementMeta.percent_of_result !== expectedPercentOfResult) {
      throw DomainError.internal('CAPITAL_PERCENT_OF_RESULT_MISMATCH', { expected: expectedPercentOfResult, actual: statementMeta.percent_of_result });
    }

    // Все проверки пройдены, генерируем документ
    const documentData: ResultContributionDecisionGenerateDocumentInputDTO = {
      decision_id: data.decision_id,
      project_name: statementMeta.project_name,
      component_name: statementMeta.component_name,
      result_hash: data.result_hash,
      percent_of_result: statementMeta.percent_of_result,
      total_amount: statementMeta.total_amount,
      coopname: platformSettings().coopname,
      username: result.username,
      registry_id: Cooperative.Registry.ResultContributionDecision.registry_id,
      lang: options?.lang as any,
    };

    const document = await this.documentPort.generate({
      data: documentData,
      options,
    });

    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация акта о вкладе результатов
   */
  async generateResultContributionAct(
    data: ResultContributionActGenerateInputDTO,
    options: GenerateDocumentOptionsInputDTO,
    currentUser: IMonoAccount
  ): Promise<GeneratedDocumentDTO> {
    // Находим результат по result_hash
    const result = await this.resultRepository.findByResultHash(data.result_hash);
    if (!result) {
      throw DomainError.internal('CAPITAL_RESULT_NOT_FOUND', { hash: data.result_hash });
    }
    if (!result.username) {
      throw DomainError.internal('CAPITAL_RESULT_USERNAME_MISSING');
    }

    // Владельца определяет результат, а не запрос. Акт формируется по
    // result.username — сверять присланное data.username было бессмысленно:
    // оно не влияет на содержимое документа, и своё имя вместе с чужим
    // result_hash открывало бы чужие суммы и долю. Поле data.username из DTO
    // не убрано: по нему RolesGuard пропускает пайщика к своим ресурсам.
    // Председатель ставит на акте вторую подпись и вправе сгенерировать любой.
    if (result.username !== currentUser.username && currentUser.role !== 'chairman') {
      throw DomainError.internal('CAPITAL_DOCUMENT_GENERATION_FOR_SELF_ONLY');
    }

    // Находим заявление по result_hash (должно быть в блокчейн данных)
    if (!result.statement) {
      throw DomainError.internal('CAPITAL_RESULT_STATEMENT_MISSING');
    }

    // Находим решение по result_hash (должно быть в блокчейн данных)
    if (!result.authorization) {
      throw DomainError.internal('CAPITAL_COUNCIL_DECISION_MISSING');
    }

    // Извлекаем данные из заявления и решения
    const statementMeta = result.statement.meta;
    const decisionMeta = result.authorization.meta;

    if (!statementMeta || !decisionMeta) {
      throw DomainError.internal('CAPITAL_STATEMENT_OR_DECISION_META_MISSING');
    }

    // Извлекаем decision_id из authorization.meta
    const decision_id = decisionMeta.decision_id;
    if (!decision_id) {
      throw DomainError.internal('CAPITAL_DECISION_ID_MISSING');
    }

    // Сверяем данные из заявления с данными решения
    if (statementMeta.component_name !== decisionMeta.component_name) {
      throw DomainError.internal('CAPITAL_COMPONENT_NAME_MISMATCH_STATEMENT_DECISION');
    }

    if (statementMeta.project_name !== decisionMeta.project_name) {
      throw DomainError.internal('CAPITAL_PROJECT_NAME_MISMATCH_STATEMENT_DECISION');
    }

    if (statementMeta.total_amount !== decisionMeta.total_amount) {
      throw DomainError.internal('CAPITAL_TOTAL_AMOUNT_MISMATCH_STATEMENT_DECISION');
    }

    if (statementMeta.percent_of_result !== decisionMeta.percent_of_result) {
      throw DomainError.internal('CAPITAL_PERCENT_MISMATCH_STATEMENT_DECISION');
    }

    if (statementMeta.result_hash !== decisionMeta.result_hash) {
      throw DomainError.internal('CAPITAL_RESULT_HASH_MISMATCH_STATEMENT_DECISION');
    }

    // Генерируем result_act_hash как SHA256 от комбинации result_hash и decision_id
    const result_act_hash = createHash('sha256')
      .update(data.result_hash + decision_id.toString())
      .digest('hex');

    // Все проверки пройдены, генерируем документ
    // (result.username проверен в начале — по нему определяется владелец акта)
    const documentData: ResultContributionActGenerateDocumentInputDTO = {
      result_act_hash,
      percent_of_result: statementMeta.percent_of_result,
      total_amount: statementMeta.total_amount,
      decision_id,
      coopname: platformSettings().coopname,
      username: result.username,
      result_hash: data.result_hash,
      registry_id: Cooperative.Registry.ResultContributionAct.registry_id,
      lang: options?.lang as any,
    };

    const document = await this.documentPort.generate({
      data: documentData,
      options,
    });

    return document as GeneratedDocumentDTO;
  }

  /**
   * Подписание акта участником CAPITAL контракта (первая подпись).
   * Участник генерирует акт, подписывает его и отправляет в блокчейн.
   */
  async signActAsContributor(
    data: SignActAsContributorInputDTO,
    currentUser: IMonoAccount
  ): Promise<SegmentOutputDTO> {
    const domainInput = {
      ...data,
      username: currentUser.username,
    };
    const segmentEntity = await this.resultSubmissionInteractor.signActAsContributor(domainInput);
    return await this.segmentMapper.toDTO(segmentEntity);
  }

  /**
   * Подписание акта председателем CAPITAL контракта (вторая подпись).
   * Председатель накладывает свою подпись на уже подписанный участником акт.
   * Акт НЕ генерируется заново - используется существующий акт из блокчейна.
   */
  async signActAsChairman(
    data: SignActAsChairmanInputDTO,
    currentUser: IMonoAccount
  ): Promise<SegmentOutputDTO> {
    const domainInput = {
      ...data,
      chairman: currentUser.username,
    };
    const segmentEntity = await this.resultSubmissionInteractor.signActAsChairman(domainInput);
    return await this.segmentMapper.toDTO(segmentEntity);
  }
}
