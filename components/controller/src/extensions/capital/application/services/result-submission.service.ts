import { Injectable, Inject } from '@nestjs/common';
import { ResultSubmissionInteractor } from '../use-cases/result-submission.interactor';
import type { IMonoAccount } from '@coopenomics/innercoop';
import type { PushResultInputDTO } from '../dto/result_submission/push-result-input.dto';
import type { ConvertSegmentInputDTO } from '../dto/result_submission/convert-segment-input.dto';
import type { SignActAsContributorInputDTO } from '../dto/result_submission/sign-act-as-contributor-input.dto';
import type { SignActAsChairmanInputDTO } from '../dto/result_submission/sign-act-as-chairman-input.dto';
import { ResultOutputDTO } from '../dto/result_submission/result.dto';
import { ResultFilterInputDTO } from '../dto/result_submission/result-filter.input';
import { PaginationInputDTO, PaginationResult, GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO,
  platformSettings,
} from '@coopenomics/extension-kit';
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
    @Inject(DOCUMENT_PORT)
    private readonly documents: IDocumentPort,
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
      throw new Error('Вы можете вносить результаты только для себя');
    }

    // Находим существующий Result по project_hash и username
    const result = await this.resultRepository.findByProjectHashAndUsername(data.project_hash, data.username);
    if (!result || !result.result_hash) {
      throw new Error(`Результат для проекта ${data.project_hash} и пользователя ${data.username} не найден. Сначала необходимо сгенерировать заявление.`);
    }

    // Получаем сгенерированный документ из репозитория по doc_hash
    const generatedDocument = await this.documents.getByHash(data.statement.doc_hash);
    if (!generatedDocument) {
      throw new Error(
        `Сгенерированный документ с хешем ${data.statement.doc_hash} не найден. Необходимо сначала сгенерировать заявление.`
      );
    }

    // Выполняем глубокую сверку подписанного и сгенерированного документов через SDK
    const comparison = await Classes.Document.compareDocuments(
      data.statement as any,
      generatedDocument as any
    );

    if (!comparison.isValid) {
      const differences = Object.entries(comparison.differences)
        .map(([field, values]) => `${field}: ожидалось "${values.expected}", получено "${values.actual}"`)
        .join('; ');
      throw new Error(
        `Сверка документов не прошла. Обнаружены расхождения: ${differences}. Возможна подмена документа.`
      );
    }

    this.logger.info(`Глубокая сверка документов успешна для результата ${result.result_hash}`);

    // Находим сегмент пользователя по проекту
    const segment = await this.segmentRepository.findOne({
      project_hash: data.project_hash,
      username: data.username,
    });

    if (!segment) {
      throw new Error(`Сегмент для пользователя ${data.username} и проекта ${data.project_hash} не найден`);
    }

    // Суммы живут в блокчейн-части сегмента. Если её нет, сегмент не
    // синхронизирован с цепью, и подставлять '0' нельзя: это не валидный ассет
    // (нет дробной части и символа) — запрос упал бы на разборе ABI, а не с
    // внятным отказом. Отсекаем здесь.
    if (!segment.intellectual_cost || !segment.debt_amount) {
      throw new Error(
        `Сегмент пользователя ${data.username} по проекту ${data.project_hash} не синхронизирован с блокчейном: не заданы сумма взноса или сумма долга. Обновите сегмент и повторите.`
      );
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
            ? 'Диаграмма BPMN (фрагмент XML)'
            : 'Диаграмма Draw.io (фрагмент XML)';
        return `*${label}*\n\n${this.fencedMarkdownCodeBlock('xml', excerpt)}`;
      }
      case StoryContentFormat.MERMAID:
        return `*Текст диаграммы Mermaid*\n\n${this.fencedMarkdownCodeBlock('mermaid', description)}`;
      case StoryContentFormat.MARKDOWN:
      default:
        return description;
    }
  }

  /**
   * Публичный метод для генерации текста результата
   * Вызывается при обновлении сегмента
   */
  async generateResultData(
    projectHash: string,
    username: string
  ): Promise<ResultDomainEntity> {
    // Находим проект
    const project = await this.projectRepository.findByHash(projectHash);
    if (!project) {
      throw new Error(`Проект с хешем ${projectHash} не найден`);
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
      throw new Error(`Сегмент для пользователя ${username} и проекта ${projectHash} не найден`);
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

    // Проверяем, существует ли уже Result для этого пользователя и проекта
    let resultEntity = await this.resultRepository.findByProjectHashAndUsername(projectHash, username);

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
          mdParts.push('#### Артефакты задачи');
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
      mdParts.push('## Исполнено');

      const completedIssues = await this.issueRepository.findCompletedByProjectAndCreators(
        project.project_hash,
        [segment.username as string]
      );

      if (completedIssues.length > 0) {
        mdParts.push(completedIssues.map((issue) => `- ${issue.title}`).join('\n'));
      }

      if (commits.length > 0) {
        mdParts.push('## Исполнение');

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
                      const title = this.escapeHtml(issue.title?.trim() || issue.issue_hash || 'Задача');
                      return `<li>${title}</li>`;
                    })
                    .join('');
                  diffHtmlBlocks.push(
                    `<div class="commit-content committed-issues"><p><strong>Задачи:</strong></p><ul>${items}</ul></div>`
                  );
                }
                break;
              }
              default: {
                const t = this.escapeHtml(String((content as { type?: string }).type ?? '?'));
                diffHtmlBlocks.push(`<div class="commit-content"><p>Неизвестный тип контента: ${t}</p></div>`);
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
      throw new Error('Вы можете генерировать документы только для себя');
    }

    // Находим существующий Result для данного пользователя и проекта
    const resultEntity = await this.resultRepository.findByProjectHashAndUsername(
      data.project_hash,
      currentUser.username
    );

    if (!resultEntity || !resultEntity.data) {
      throw new Error(
        `Текст результата не найден. Необходимо сначала обновить сегмент для проекта ${data.project_hash}`
      );
    }

    // Находим проект по project_hash
    const project = await this.projectRepository.findByHash(data.project_hash);
    if (!project) {
      throw new Error(`Проект с хешем ${data.project_hash} не найден`);
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
      throw new Error(`Сегмент для пользователя ${currentUser.username} и проекта ${data.project_hash} не найден`);
    }

    // Извлекаем данные
    const coopname = platformSettings().coopname;
    const username = currentUser.username;

    if (!project.title) {
      throw new Error(`Название компонента не найдено`);
    }
    // component_name - название текущего проекта
    const component_name = project.title;

    // project_name - название родительского проекта
    if (!parentProject?.title) {
      throw new Error(`Название проекта не найдено`);
    }
    const project_name = parentProject.title;

    if (!segment.intellectual_cost) {
      throw new Error(`Сумма сегмента не найдена`);
    }
    // total_amount - из сегмента поле intellectual_cost
    const total_amount = segment.intellectual_cost;

    // percent_of_result - рассчитываем как процент от fact.total_amount с округлением
    if (!project.fact?.total) {
      throw new Error(`Сумма проекта не найдена`);
    }

    const factTotalAmount = parseFloat(project.fact.total);
    if (factTotalAmount <= 0) {
      throw new Error(`Сумма проекта не может быть меньше или равна 0`);
    }

    if (!segment.share_percent) {
      throw new Error('Доля участника в результате (segment.share_percent) не найдена');
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
      throw new Error(`Результат с хешем ${data.result_hash} не найден`);
    }

    // Находим заявление по result_hash (должно быть в блокчейн данных)
    if (!result.statement) {
      throw new Error('Заявление не найдено в данных результата');
    }

    // Извлекаем данные из заявления
    const statementMeta = result.statement.meta;
    if (!statementMeta) {
      throw new Error('Мета-данные заявления не найдены');
    }

    // Сверяем данные с текущими данными проекта и сегмента
    if (!result.project_hash) {
      throw new Error('Хеш проекта не найден в результате');
    }
    const project = await this.projectRepository.findByHash(result.project_hash);
    if (!project) {
      throw new Error(`Проект с хешем ${result.project_hash} не найден`);
    }

    // Находим родительский проект
    const parentProject = project.parent_hash
      ? await this.projectRepository.findByHash(project.parent_hash)
      : null;

    // Находим сегмент
    if (!result.username) {
      throw new Error('Имя пользователя не найдено в результате');
    }
    const segment = await this.segmentRepository.findOne({
      project_hash: result.project_hash,
      username: result.username,
    });

    if (!segment) {
      throw new Error(`Сегмент для пользователя ${result.username} и проекта ${result.project_hash} не найден`);
    }

    // Сверяем данные из заявления с текущими данными
    if (!project.title) {
      throw new Error('Название компонента (project.title) не найдено');
    }
    const expectedComponentName = project.title;

    if (!parentProject?.title) {
      throw new Error('Название проекта (parentProject.title) не найдено');
    }
    const expectedProjectName = parentProject.title;

    if (!segment.intellectual_cost) {
      throw new Error('Интеллектуальная стоимость сегмента (segment.intellectual_cost) не найдена');
    }
    const expectedTotalAmount = segment.intellectual_cost;

    if (!project.fact?.total) {
      throw new Error('Общая сумма проекта (project.fact.total) не найдена');
    }

    if (!segment.share_percent) {
      throw new Error('Доля участника в результате (segment.share_percent) не найдена');
    }
    const expectedPercentOfResult = (segment.share_percent).toFixed(8);

    // Сверка данных
    if (statementMeta.component_name !== expectedComponentName) {
      throw new Error(`Несоответствие названия компонента: ожидалось "${expectedComponentName}", получено "${statementMeta.component_name}"`);
    }

    if (statementMeta.project_name !== expectedProjectName) {
      throw new Error(`Несоответствие названия проекта: ожидалось "${expectedProjectName}", получено "${statementMeta.project_name}"`);
    }

    if (statementMeta.total_amount !== expectedTotalAmount) {
      throw new Error(`Несоответствие общей суммы: ожидалось "${expectedTotalAmount}", получено "${statementMeta.total_amount}"`);
    }

    if (statementMeta.percent_of_result !== expectedPercentOfResult) {
      throw new Error(`Несоответствие процента от результата: ожидалось "${expectedPercentOfResult}", получено "${statementMeta.percent_of_result}"`);
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
      throw new Error(`Результат с хешем ${data.result_hash} не найден`);
    }
    if (!result.username) {
      throw new Error('Имя пользователя не найдено в результате');
    }

    // Владельца определяет результат, а не запрос. Акт формируется по
    // result.username — сверять присланное data.username было бессмысленно:
    // оно не влияет на содержимое документа, и своё имя вместе с чужим
    // result_hash открывало бы чужие суммы и долю. Поле data.username из DTO
    // не убрано: по нему RolesGuard пропускает пайщика к своим ресурсам.
    // Председатель ставит на акте вторую подпись и вправе сгенерировать любой.
    if (result.username !== currentUser.username && currentUser.role !== 'chairman') {
      throw new Error('Вы можете генерировать документы только для себя');
    }

    // Находим заявление по result_hash (должно быть в блокчейн данных)
    if (!result.statement) {
      throw new Error('Заявление не найдено в данных результата');
    }

    // Находим решение по result_hash (должно быть в блокчейн данных)
    if (!result.authorization) {
      throw new Error('Решение совета не найдено в данных результата');
    }

    // Извлекаем данные из заявления и решения
    const statementMeta = result.statement.meta;
    const decisionMeta = result.authorization.meta;

    if (!statementMeta || !decisionMeta) {
      throw new Error('Мета-данные заявления или решения не найдены');
    }

    // Извлекаем decision_id из authorization.meta
    const decision_id = decisionMeta.decision_id;
    if (!decision_id) {
      throw new Error('ID решения не найден в мета-данных решения');
    }

    // Сверяем данные из заявления с данными решения
    if (statementMeta.component_name !== decisionMeta.component_name) {
      throw new Error(`Несоответствие названия компонента между заявлением и решением`);
    }

    if (statementMeta.project_name !== decisionMeta.project_name) {
      throw new Error(`Несоответствие названия проекта между заявлением и решением`);
    }

    if (statementMeta.total_amount !== decisionMeta.total_amount) {
      throw new Error(`Несоответствие общей суммы между заявлением и решением`);
    }

    if (statementMeta.percent_of_result !== decisionMeta.percent_of_result) {
      throw new Error(`Несоответствие процента от результата между заявлением и решением`);
    }

    if (statementMeta.result_hash !== decisionMeta.result_hash) {
      throw new Error(`Несоответствие хеша результата между заявлением и решением`);
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
