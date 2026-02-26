import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ResultSubmissionInteractor } from '../use-cases/result-submission.interactor';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import type { PushResultInputDTO } from '../dto/result_submission/push-result-input.dto';
import type { ConvertSegmentInputDTO } from '../dto/result_submission/convert-segment-input.dto';
import type { SignActAsContributorInputDTO } from '../dto/result_submission/sign-act-as-contributor-input.dto';
import type { SignActAsChairmanInputDTO } from '../dto/result_submission/sign-act-as-chairman-input.dto';
import { ResultOutputDTO } from '../dto/result_submission/result.dto';
import { ResultFilterInputDTO } from '../dto/result_submission/result-filter.input';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { ResultContributionStatementGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-statement-input.dto';
import { ResultContributionDecisionGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-decision-input.dto';
import { ResultContributionActGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-act-input.dto';
import { ResultContributionStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/result-contribution-statement-document.dto';
import { ResultContributionDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/result-contribution-decision-document.dto';
import { ResultContributionActGenerateDocumentInputDTO } from '~/application/document/documents-dto/result-contribution-act-document.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';
import { Classes } from '@coopenomics/sdk';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';
import { SegmentMapper } from '../../infrastructure/mappers/segment.mapper';
import { ResultMapper } from '../../infrastructure/mappers/result.mapper';
import MarkdownIt from 'markdown-it';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { COMMIT_REPOSITORY, CommitRepository } from '../../domain/repositories/commit.repository';
import { RESULT_REPOSITORY, ResultRepository } from '../../domain/repositories/result.repository';
import { SEGMENT_REPOSITORY, SegmentRepository } from '../../domain/repositories/segment.repository';
import { ResultStatus } from '../../domain/enums/result-status.enum';
import { ResultDomainEntity } from '../../domain/entities/result.entity';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { SegmentDomainEntity } from '../../domain/entities/segment.entity';
import { CommitDomainEntity, type CommitContentData, type ICommitGitData } from '../../domain/entities/commit.entity';
import { STORY_REPOSITORY, StoryRepository } from '../../domain/repositories/story.repository';
import { ISSUE_REPOSITORY, IssueRepository } from '../../domain/repositories/issue.repository';
import type { IResultDatabaseData } from '../../domain/interfaces/result-database.interface';
import { createHash } from 'crypto';
import { config } from '~/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '~/domain/document/repository/document.repository';
/**
 * Сервис уровня приложения для подачи результатов в CAPITAL
 * Обрабатывает запросы от ResultSubmissionResolver
 */
@Injectable()
export class ResultSubmissionService {
  constructor(
    private readonly resultSubmissionInteractor: ResultSubmissionInteractor,
    private readonly documentInteractor: DocumentInteractor,
    private readonly segmentMapper: SegmentMapper,
    private readonly resultMapper: ResultMapper,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(COMMIT_REPOSITORY)
    private readonly commitRepository: CommitRepository,
    @Inject(RESULT_REPOSITORY)
    private readonly resultRepository: ResultRepository,
    @Inject(SEGMENT_REPOSITORY)
    private readonly segmentRepository: SegmentRepository,
    @Inject(STORY_REPOSITORY)
    private readonly storyRepository: StoryRepository,
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepository,
    private readonly logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.logger.setContext(ResultSubmissionService.name);
  }

  /**
   * Внесение результата в CAPITAL контракте
   */
  async pushResult(data: PushResultInputDTO, currentUser: MonoAccountDomainInterface): Promise<SegmentOutputDTO> {
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
    const generatedDocument = await this.documentRepository.findByHash(data.statement.doc_hash);
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

    // Формируем данные для domain layer
    // Используем присланный подписанный документ (он прошел глубокую проверку)
    const domainInput = {
      coopname: config.coopname,
      username: data.username,
      project_hash: data.project_hash,
      result_hash: result.result_hash,
      contribution_amount: segment.intellectual_cost || '0', // берем из сегмента
      debt_amount: segment.debt_amount || '0', // берем из сегмента
      statement: data.statement,
      debt_hashes: [], // пока пустой массив
    };

    const segmentEntity = await this.resultSubmissionInteractor.pushResult(domainInput);

    // Получаем обновлённый результат для синхронизации с GitHub
    const updatedResult = await this.resultRepository.findByResultHash(result.result_hash);
    if (updatedResult) {
      // Генерируем событие для синхронизации с GitHub
      this.eventEmitter.emit('result.updated', updatedResult);
    }

    return await this.segmentMapper.toDTO(segmentEntity);
  }

  /**
   * Конвертация сегмента в CAPITAL контракте
   */
  async convertSegment(data: ConvertSegmentInputDTO, currentUser: MonoAccountDomainInterface): Promise<SegmentOutputDTO> {
    const segmentEntity = await this.resultSubmissionInteractor.convertSegment(data, currentUser);
    return await this.segmentMapper.toDTO(segmentEntity);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех результатов с фильтрацией
   */
  async getResults(filter?: ResultFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<ResultOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

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

  /**
   * Преобразование Markdown в HTML
   */
  private convertMarkdownToHtml(markdown: string): string {
    if (!markdown) return '';

    try {

      const md = new MarkdownIt({
        html: true,        // Разрешить HTML теги
        linkify: true,     // Автоматически конвертировать URL в ссылки
        typographer: true  // Умные кавычки и тире
      });

      return md.render(markdown);
    } catch (err) {
      console.warn('Failed to convert markdown to HTML:', err);
      return markdown; // Возвращаем исходный markdown если конвертация не удалась
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
        coopname: config.coopname,
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
   * Формирование HTML документа результата на основе ролей пользователя
   */
  private async generateCombinedData(
    project: ProjectDomainEntity,
    segment: SegmentDomainEntity,
    commits: CommitDomainEntity[],
    parentProject?: ProjectDomainEntity | null
  ): Promise<string> {
    const htmlParts: string[] = [];

    // Начало HTML документа
    htmlParts.push('<!DOCTYPE html>');
    htmlParts.push('<html>');
    htmlParts.push('<head>');
    htmlParts.push('<meta charset="UTF-8">');
    htmlParts.push('<title>Результат интеллектуальной деятельности</title>');
    htmlParts.push('<style>');
    htmlParts.push('.result-document { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }');
    htmlParts.push('.result-title { border-bottom: 2px solid #333; padding-bottom: 10px; }');
    htmlParts.push('.result-metadata { display: none; }');
    htmlParts.push('.result-section { margin-top: 30px; }');
    htmlParts.push('.result-description { margin: 15px 0; }');
    htmlParts.push('.requirements-list, .tasks-list { margin: 10px 0; padding-left: 20px; }');
    htmlParts.push('.requirements-list li, .tasks-list li { margin: 5px 0; }');
    htmlParts.push('.task-requirements { margin: 10px 0; padding-left: 20px; }');
    htmlParts.push('.task-requirements li { margin: 3px 0; }');
    htmlParts.push('.executed-tasks { margin: 10px 0; padding-left: 20px; }');
    htmlParts.push('.executed-tasks li { margin: 5px 0; }');
    htmlParts.push('.result-section-title { margin-top: 30px; }');
    htmlParts.push('.commit-link { margin-bottom: 15px; }');
    htmlParts.push('.commit-url { color: #0066cc; text-decoration: none; }');
    htmlParts.push('.commit-url:hover { text-decoration: underline; }');
    htmlParts.push('.diff-container { font-family: monospace; border: 1px solid #d1d5db; border-radius: 6px; padding: 16px; margin: 10px 0; overflow-x: auto; }');
    htmlParts.push('.diff-header { font-weight: bold; margin: 0; padding: 2px 0; }');
    htmlParts.push('.diff-meta { margin: 0; padding: 2px 0; }');
    htmlParts.push('.diff-hunk { font-weight: bold; margin: 0; padding: 2px 0; }');
    htmlParts.push('.diff-add { margin: 0; padding: 2px 0; }');
    htmlParts.push('.diff-del { margin: 0; padding: 2px 0; }');
    htmlParts.push('.diff-normal { margin: 0; padding: 2px 0; }');
    htmlParts.push('</style>');
    htmlParts.push('</head>');
    htmlParts.push('<body class="result-document">');

    // Скрытые мета-данные для уникальности хеша (username + project_hash)
    htmlParts.push(`<div class="result-metadata" aria-hidden="true">`);
    htmlParts.push(`<span>Contributor: ${segment.username}</span>`);
    htmlParts.push(`<span>Project: ${project.project_hash}</span>`);
    htmlParts.push('</div>');

    // Заголовок компонента у всех
    const parentProjectTitle = parentProject?.title || '';
    const componentTitle = project.title || '';
    const fullTitle = parentProjectTitle ? `${parentProjectTitle}. ${componentTitle}` : componentTitle;
    htmlParts.push(`<h1 class="result-title">${fullTitle}</h1>`);

    // Если пользователь является автором или координатором
    if (segment.is_author || segment.is_coordinator ||  segment.is_contributor) {
      htmlParts.push('<h2 class="result-section">Техническое Задание</h2>');

      // Описание проекта
      if (project.description) {
        const projectDescriptionHtml = this.convertMarkdownToHtml(project.description);
        htmlParts.push(`<div class="result-description">${projectDescriptionHtml}</div>`);
      }

      // Получаем проектные требования (Stories не привязанные к задачам)
      // Используем findProjectStories для явного извлечения только проектных требований
      const projectStories = await this.storyRepository.findProjectStories(project.project_hash);

      // Требования проекта (только к компоненту, без требований к задачам)
      if (projectStories.length > 0) {
        htmlParts.push('<ul class="requirements-list">');
        projectStories.forEach(story => {
          htmlParts.push(`<li><strong>${story.title}</strong>`);
          if (story.description && story.description !== '{}') {
            const storyDescriptionHtml = this.convertMarkdownToHtml(story.description);
            htmlParts.push(`<br>${storyDescriptionHtml}`);
          }
          htmlParts.push('</li>');
        });
        htmlParts.push('</ul>');
      }

      // Получаем все задачи проекта
      const projectIssues = await this.issueRepository.findByProjectHash(project.project_hash);

      // Задачи проекта с их требованиями
      if (projectIssues.length > 0) {
        htmlParts.push('<ul class="tasks-list">');
        for (const issue of projectIssues) {
          htmlParts.push(`<li><strong>${issue.title}</strong>`);
          if (issue.description) {
            const issueDescriptionHtml = this.convertMarkdownToHtml(issue.description);
            htmlParts.push(`<br>${issueDescriptionHtml}`);
          }

          // Получаем требования для этой задачи
          const issueStories = await this.storyRepository.findByIssueHash(issue.issue_hash);
          if (issueStories.length > 0) {
            htmlParts.push('<ul class="task-requirements">');
            issueStories.forEach(story => {
              htmlParts.push(`<li>${story.title}`);
              if (story.description && story.description !== '{}') {
                const storyDescriptionHtml = this.convertMarkdownToHtml(story.description);
                htmlParts.push(`<br>${storyDescriptionHtml}`);
              }
              htmlParts.push('</li>');
            });
            htmlParts.push('</ul>');
          }
          htmlParts.push('</li>');
        }
        htmlParts.push('</ul>');
      }
    }

    // Если пользователь является создателем/исполнителем
    if (segment.is_creator) {
      htmlParts.push('<h2 class="result-section-title">Исполнено:</h2>');

      // Получаем выполненные задачи пользователя в этом проекте
      const completedIssues = await this.issueRepository.findCompletedByProjectAndCreators(
        project.project_hash,
        [segment.username as string]
      );

      // Выполненные задачи (только те, которые выполнял пользователь)
      if (completedIssues.length > 0) {
        htmlParts.push('<ul class="executed-tasks">');
        completedIssues.forEach(issue => {
          htmlParts.push(`<li>${issue.title}</li>`);
        });
        htmlParts.push('</ul>');
      }

      // Результат - все коммиты пользователя
      if (commits.length > 0) {
        htmlParts.push('<h2 class="result-section-title">Исполнение:</h2>');
        commits.forEach(commit => {
          if (commit.data && commit.data.length > 0) {
            commit.data.forEach((content: CommitContentData) => {
              htmlParts.push('<div class="commit-content">');

              // Обрабатываем разные типы контента
              switch (content.type) {
                case 'git': {
                  const gitData: ICommitGitData = content.data;
                  htmlParts.push(`<p><a class="commit-url" href="${gitData.url}" target="_blank">${gitData.url}</a> (${gitData.type})</p>`);
                  if (gitData.diff) {
                    htmlParts.push('<div class="diff-container">');
                    // Разбираем diff по строкам и оформляем каждую
                    const diffLines = gitData.diff.split('\n');
                    diffLines.forEach(line => {
                      const escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                      // Заголовки файлов (diff --git)
                      if (line.startsWith('diff --git')) {
                        htmlParts.push(`<div class="diff-header">${escapedLine}</div>`);
                      }
                      // Индексы и режимы файлов
                      else if (line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file') || line.startsWith('---') || line.startsWith('+++')) {
                        htmlParts.push(`<div class="diff-meta">${escapedLine}</div>`);
                      }
                      // Заголовки блоков изменений (@@)
                      else if (line.startsWith('@@')) {
                        htmlParts.push(`<div class="diff-hunk">${escapedLine}</div>`);
                      }
                      // Добавленные строки (+)
                      else if (line.startsWith('+')) {
                        htmlParts.push(`<div class="diff-add">${escapedLine}</div>`);
                      }
                      // Удалённые строки (-)
                      else if (line.startsWith('-')) {
                        htmlParts.push(`<div class="diff-del">${escapedLine}</div>`);
                      }
                      // Обычные строки
                      else {
                        htmlParts.push(`<div class="diff-normal">${escapedLine}</div>`);
                      }
                    });
                    htmlParts.push('</div>');
                  }
                  break;
                }

                default: {
                  htmlParts.push(`<p>Неизвестный тип контента: ${(content as any).type}</p>`);
                }
              }

              htmlParts.push('</div>');
            });
          }
        });
      }
    }

    // Закрываем HTML документ
    htmlParts.push('</body>');
    htmlParts.push('</html>');

    return htmlParts.join('\n');
  }

  /**
   * Генерация заявления о вкладе результатов
   * Использует уже сгенерированный текст результата из базы данных
   * Документ автоматически сохраняется в репозитории документов
   */
  async generateResultContributionStatement(
    data: ResultContributionStatementGenerateInputDTO,
    options: GenerateDocumentOptionsInputDTO,
    currentUser: MonoAccountDomainInterface
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
    const coopname = config.coopname;
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

    const document = await this.documentInteractor.generateDocument({
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
    _currentUser: MonoAccountDomainInterface
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
      coopname: config.coopname,
      username: result.username,
      registry_id: Cooperative.Registry.ResultContributionDecision.registry_id,
      lang: options?.lang as any,
    };

    const document = await this.documentInteractor.generateDocument({
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
    currentUser: MonoAccountDomainInterface
  ): Promise<GeneratedDocumentDTO> {
    // Проверяем, что пользователь может генерировать документы только для себя
    // Председатель может генерировать документы для любого пользователя
    if (data.username !== currentUser.username && currentUser.role !== 'chairman') {
      throw new Error('Вы можете генерировать документы только для себя');
    }
    // Находим результат по result_hash
    const result = await this.resultRepository.findByResultHash(data.result_hash);
    if (!result) {
      throw new Error(`Результат с хешем ${data.result_hash} не найден`);
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
    if (!result.username) {
      throw new Error('Имя пользователя не найдено в результате');
    }
    const documentData: ResultContributionActGenerateDocumentInputDTO = {
      result_act_hash,
      percent_of_result: statementMeta.percent_of_result,
      total_amount: statementMeta.total_amount,
      decision_id,
      coopname: config.coopname,
      username: result.username,
      result_hash: data.result_hash,
      registry_id: Cooperative.Registry.ResultContributionAct.registry_id,
      lang: options?.lang as any,
    };

    const document = await this.documentInteractor.generateDocument({
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
    currentUser: MonoAccountDomainInterface
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
    currentUser: MonoAccountDomainInterface
  ): Promise<SegmentOutputDTO> {
    const domainInput = {
      ...data,
      chairman: currentUser.username,
    };
    const segmentEntity = await this.resultSubmissionInteractor.signActAsChairman(domainInput);
    return await this.segmentMapper.toDTO(segmentEntity);
  }
}
