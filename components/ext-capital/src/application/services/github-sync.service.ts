import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { GitHubService } from '../../infrastructure/services/github.service';
import { FileFormatService } from '../../domain/services/file-format.service';
import {
  GITHUB_FILE_INDEX_REPOSITORY,
  type GitHubFileIndexRepository,
} from '../../domain/repositories/github-file-index.repository';
import { PROJECT_REPOSITORY, type ProjectRepository } from '../../domain/repositories/project.repository';
import { ISSUE_REPOSITORY, type IssueRepository } from '../../domain/repositories/issue.repository';
import { STORY_REPOSITORY, type StoryRepository } from '../../domain/repositories/story.repository';
import { RESULT_REPOSITORY, type ResultRepository } from '../../domain/repositories/result.repository';
import { SEGMENT_REPOSITORY, type SegmentRepository } from '../../domain/repositories/segment.repository';
import { USER_REPOSITORY, type UserRepository } from '~/domain/user/repositories/user.repository';
import { ProjectManagementService } from './project-management.service';
import { GenerationService } from './generation.service';
import type { ProjectDomainEntity } from '../../domain/entities/project.entity';
import type { IssueDomainEntity } from '../../domain/entities/issue.entity';
import type { StoryDomainEntity } from '../../domain/entities/story.entity';
import type { ResultDomainEntity } from '../../domain/entities/result.entity';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { config } from '~/config';

/**
 * Сервис для синхронизации с GitHub
 * Обрабатывает двухстороннюю синхронизацию между БД и GitHub репозиторием
 */
@Injectable()
export class GitHubSyncService {
  private readonly logger = new Logger(GitHubSyncService.name);
  private owner = '';
  private repo = '';
  private coopname = '';
  private githubRepository = '';

  constructor(
    private readonly githubService: GitHubService,
    private readonly fileFormatService: FileFormatService,
    @Inject(GITHUB_FILE_INDEX_REPOSITORY)
    private readonly fileIndexRepository: GitHubFileIndexRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    @Inject(STORY_REPOSITORY)
    private readonly storyRepository: StoryRepository,
    @Inject(RESULT_REPOSITORY)
    private readonly resultRepository: ResultRepository,
    @Inject(SEGMENT_REPOSITORY)
    private readonly segmentRepository: SegmentRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly projectManagementService: ProjectManagementService,
    private readonly generationService: GenerationService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.coopname = config.coopname;
  }

  /**
   * Инициализация сервиса с параметрами репозитория
   */
  initialize(githubRepository: string): void {
    if (!githubRepository || !githubRepository.includes('/')) {
      throw new Error('Неверный формат github_repository. Ожидается формат: owner/repo');
    }

    const [owner, repo] = githubRepository.split('/');
    this.owner = owner.trim();
    this.repo = repo.trim();
    this.githubRepository = githubRepository;

    this.logger.log(`GitHub синхронизация инициализирована для репозитория ${this.owner}/${this.repo}`);
  }

  /**
   * Проверить, включена ли синхронизация с GitHub
   */
  isEnabled(): boolean {
    return this.githubService.isAvailable() && !!this.githubRepository;
  }

  /**
   * Получить председателя кооператива для операций от его имени
   */
  private async getChairman(): Promise<MonoAccountDomainInterface> {
    const chairman = await this.userRepository.findByRoles(['chairman']);
    if (chairman.length === 0) {
      throw new Error('Председатель кооператива не найден');
    }
    return chairman[0] as unknown as MonoAccountDomainInterface;
  }

  /**
   * Синхронизация проекта в GitHub (DB → GitHub)
   */
  async syncProjectToGitHub(project: ProjectDomainEntity): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('GitHub синхронизация отключена, пропускаем синхронизацию проекта');
      return;
    }

    try {
      this.logger.debug(`Синхронизация проекта ${project.project_hash} в GitHub`);

      // Генерируем markdown файл
      const { content, slug } = this.fileFormatService.projectToMarkdown(project);

      // Генерируем путь к файлу
      const isComponent = project.isComponent();
      let filePath: string;

      if (isComponent) {
        // Компонент находится в подпапке родительского проекта
        const parentProject = await this.projectRepository.findByHash(project.parent_hash || '');
        if (!parentProject) {
          this.logger.warn(`Родительский проект ${project.parent_hash} не найден, пропускаем синхронизацию компонента`);
          return;
        }
        const parentSlug = this.fileFormatService.generateSlug(parentProject.title || 'unnamed-project');
        filePath = `${parentSlug}/components/${slug}/component.md`;
      } else {
        filePath = `${slug}/project.md`;
      }

      // Проверяем, нужно ли переименование
      const existingIndex = await this.fileIndexRepository.findByHash('project', project.project_hash, this.coopname);
      if (existingIndex && existingIndex.file_path !== filePath) {
        // Файл был переименован, удаляем старый
        await this.handleFileRename('project', project.project_hash, existingIndex.file_path, filePath, content);
        return;
      }

      // Получаем SHA существующего файла (если есть)
      const existingSha = await this.githubService.getFileSha(this.owner, this.repo, filePath);

      // Создаём или обновляем файл
      const commitMessage = existingSha
        ? `Update project: ${project.title}`
        : `Create project: ${project.title}`;

      const newSha = await this.githubService.createOrUpdateFile(
        this.owner,
        this.repo,
        filePath,
        content,
        commitMessage,
        existingSha || undefined
      );

      // Обновляем индекс
      await this.fileIndexRepository.upsert({
        coopname: this.coopname,
        entity_type: 'project',
        entity_hash: project.project_hash,
        file_path: filePath,
        github_sha: newSha,
      });

      this.logger.log(`Проект ${project.project_hash} успешно синхронизирован в GitHub`);
    } catch (error: any) {
      this.logger.error(`Ошибка синхронизации проекта ${project.project_hash} в GitHub: ${error.message}`, error.stack);
    }
  }

  /**
   * Синхронизация задачи в GitHub (DB → GitHub)
   */
  async syncIssueToGitHub(issue: IssueDomainEntity): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('GitHub синхронизация отключена, пропускаем синхронизацию задачи');
      return;
    }

    try {
      this.logger.debug(`Синхронизация задачи ${issue.issue_hash} в GitHub`);

      // Получаем проект для определения пути
      const project = await this.projectRepository.findByHash(issue.project_hash);
      if (!project) {
        this.logger.warn(`Проект ${issue.project_hash} не найден, пропускаем синхронизацию задачи`);
        return;
      }

      // Определяем базовый путь в зависимости от того, является ли проект компонентом
      let basePath: string;
      if (project.isComponent()) {
        // Это компонент, нужно получить родительский проект
        const parentProject = await this.projectRepository.findByHash(project.parent_hash || '');
        if (!parentProject) {
          this.logger.warn(`Родительский проект ${project.parent_hash} не найден, пропускаем синхронизацию задачи`);
          return;
        }
        const parentSlug = this.fileFormatService.generateSlug(parentProject.title || 'unnamed-project');
        const componentSlug = this.fileFormatService.generateSlug(project.title || 'unnamed-component');
        basePath = `${parentSlug}/components/${componentSlug}`;
      } else {
        // Это корневой проект
        basePath = this.fileFormatService.generateSlug(project.title || 'unnamed-project');
      }

      // Генерируем markdown файл
      const { content, slug } = this.fileFormatService.issueToMarkdown(issue);
      const filePath = `${basePath}/issues/${slug}.md`;

      // Проверяем, нужно ли переименование
      const existingIndex = await this.fileIndexRepository.findByHash('issue', issue.issue_hash, this.coopname);
      if (existingIndex && existingIndex.file_path !== filePath) {
        await this.handleFileRename('issue', issue.issue_hash, existingIndex.file_path, filePath, content);
        return;
      }

      // Получаем SHA существующего файла (всегда свежий)
      const existingSha = await this.githubService.getFileSha(this.owner, this.repo, filePath);

      // Создаём или обновляем файл
      const commitMessage = existingSha ? `Update issue: ${issue.title}` : `Create issue: ${issue.title}`;

      const newSha = await this.githubService.createOrUpdateFile(
        this.owner,
        this.repo,
        filePath,
        content,
        commitMessage,
        existingSha || undefined
      );

      // Обновляем индекс
      await this.fileIndexRepository.upsert({
        coopname: this.coopname,
        entity_type: 'issue',
        entity_hash: issue.issue_hash,
        file_path: filePath,
        github_sha: newSha,
      });

      this.logger.log(`Задача ${issue.issue_hash} успешно синхронизирована в GitHub`);
    } catch (error: any) {
      this.logger.error(`Ошибка синхронизации задачи ${issue.issue_hash} в GitHub: ${error.message}`, error.stack);
    }
  }

  /**
   * Синхронизация требования в GitHub (DB → GitHub)
   */
  async syncStoryToGitHub(story: StoryDomainEntity): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('GitHub синхронизация отключена, пропускаем синхронизацию требования');
      return;
    }

    try {
      this.logger.debug(`Синхронизация требования ${story.story_hash} в GitHub`);

      // Получаем проект для определения пути
      const projectHash = story.project_hash;
      if (!projectHash) {
        this.logger.warn(`Требование ${story.story_hash} не привязано к проекту, пропускаем синхронизацию`);
        return;
      }

      const project = await this.projectRepository.findByHash(projectHash);
      if (!project) {
        this.logger.warn(`Проект ${projectHash} не найден, пропускаем синхронизацию требования`);
        return;
      }

      // Определяем базовый путь в зависимости от того, является ли проект компонентом
      let basePath: string;
      if (project.isComponent()) {
        // Это компонент, нужно получить родительский проект
        const parentProject = await this.projectRepository.findByHash(project.parent_hash || '');
        if (!parentProject) {
          this.logger.warn(`Родительский проект ${project.parent_hash} не найден, пропускаем синхронизацию требования`);
          return;
        }
        const parentSlug = this.fileFormatService.generateSlug(parentProject.title || 'unnamed-project');
        const componentSlug = this.fileFormatService.generateSlug(project.title || 'unnamed-component');
        basePath = `${parentSlug}/components/${componentSlug}`;
      } else {
        // Это корневой проект
        basePath = this.fileFormatService.generateSlug(project.title || 'unnamed-project');
      }

      // Определяем, относится ли требование к задаче
      let issueSlug: string | undefined;
      if (story.issue_hash) {
        const issue = await this.issueRepository.findByIssueHash(story.issue_hash);
        if (issue) {
          issueSlug = this.fileFormatService.generateSlug(issue.title);
        }
      }

      // Генерируем markdown файл
      const { content, slug } = this.fileFormatService.storyToMarkdown(story);
      const filePath = issueSlug
        ? `${basePath}/issues/${issueSlug}-requirements/${slug}.md`
        : `${basePath}/requirements/${slug}.md`;

      // Проверяем, нужно ли переименование
      const existingIndex = await this.fileIndexRepository.findByHash('story', story.story_hash, this.coopname);
      if (existingIndex && existingIndex.file_path !== filePath) {
        await this.handleFileRename('story', story.story_hash, existingIndex.file_path, filePath, content);
        return;
      }

      // Получаем SHA существующего файла (всегда свежий)
      const existingSha = await this.githubService.getFileSha(this.owner, this.repo, filePath);

      // Создаём или обновляем файл
      const commitMessage = existingSha ? `Update story: ${story.title}` : `Create story: ${story.title}`;

      const newSha = await this.githubService.createOrUpdateFile(
        this.owner,
        this.repo,
        filePath,
        content,
        commitMessage,
        existingSha || undefined
      );

      // Обновляем индекс
      await this.fileIndexRepository.upsert({
        coopname: this.coopname,
        entity_type: 'story',
        entity_hash: story.story_hash,
        file_path: filePath,
        github_sha: newSha,
      });

      this.logger.log(`Требование ${story.story_hash} успешно синхронизировано в GitHub`);
    } catch (error: any) {
      this.logger.error(`Ошибка синхронизации требования ${story.story_hash} в GitHub: ${error.message}`, error.stack);
    }
  }

  /**
   * Обработка переименования файла
   */
  private async handleFileRename(
    entityType: string,
    entityHash: string,
    oldPath: string,
    newPath: string,
    newContent: string
  ): Promise<void> {
    this.logger.log(`Переименование файла: ${oldPath} → ${newPath}`);

    // Получаем SHA старого файла
    const oldSha = await this.githubService.getFileSha(this.owner, this.repo, oldPath);

    // Удаляем старый файл
    if (oldSha) {
      await this.githubService.deleteFile(this.owner, this.repo, oldPath, `Rename: remove old file ${oldPath}`, oldSha);
    }

    // Создаём новый файл
    const newSha = await this.githubService.createOrUpdateFile(
      this.owner,
      this.repo,
      newPath,
      newContent,
      `Rename: create new file ${newPath}`
    );

    // Обновляем индекс
    await this.fileIndexRepository.upsert({
      coopname: this.coopname,
      entity_type: entityType as any,
      entity_hash: entityHash,
      file_path: newPath,
      github_sha: newSha,
    });

    // Если переименовывается проект, нужно пересинхронизировать все связанные сущности
    if (entityType === 'project') {
      await this.resyncProjectRelatedEntities(entityHash);
    }
  }

  /**
   * Пересинхронизация всех связанных сущностей при переименовании проекта
   * Необходимо для перемещения issues, stories и results в новую папку проекта
   */
  private async resyncProjectRelatedEntities(projectHash: string): Promise<void> {
    this.logger.log(`Пересинхронизация связанных сущностей для проекта ${projectHash}`);

    try {
      // Находим все issues проекта
      const issues = await this.issueRepository.findByProjectHash(projectHash);
      this.logger.debug(`Найдено ${issues.length} задач для пересинхронизации`);

      for (const issue of issues) {
        try {
          await this.syncIssueToGitHub(issue);
        } catch (error: any) {
          this.logger.warn(`Ошибка синхронизации задачи ${issue.issue_hash}: ${error.message}`);
        }
      }

      // Находим все stories проекта
      const stories = await this.storyRepository.findByProjectHash(projectHash);
      this.logger.debug(`Найдено ${stories.length} требований для пересинхронизации`);

      for (const story of stories) {
        try {
          await this.syncStoryToGitHub(story);
        } catch (error: any) {
          this.logger.warn(`Ошибка синхронизации требования ${story.story_hash}: ${error.message}`);
        }
      }

      // Находим все results проекта
      const results = await this.resultRepository.findByProjectHash(projectHash);
      this.logger.debug(`Найдено ${results.length} результатов для пересинхронизации`);

      for (const result of results) {
        try {
          await this.syncResultToGitHub(result);
        } catch (error: any) {
          this.logger.warn(`Ошибка синхронизации результата ${result.result_hash}: ${error.message}`);
        }
      }

      this.logger.log(`Пересинхронизация связанных сущностей для проекта ${projectHash} завершена`);
    } catch (error: any) {
      this.logger.error(
        `Ошибка пересинхронизации связанных сущностей для проекта ${projectHash}: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Синхронизация из GitHub в БД (GitHub → DB)
   */
  async syncFromGitHub(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('GitHub синхронизация отключена');
      return;
    }

    try {
      this.logger.debug('Начало синхронизации из GitHub');

      // Получаем последний коммит (создаёт начальный коммит, если репозиторий пустой)
      const latestSha = await this.githubService.getLatestCommit(this.owner, this.repo);

      // Получаем последний синхронизированный SHA
      const lastSyncedSha = await this.fileIndexRepository.getLastSyncedSha(this.coopname);

      if (lastSyncedSha === latestSha) {
        this.logger.debug('Нет новых изменений в GitHub');
        return;
      }

      // Если это первая синхронизация, получаем все файлы
      if (!lastSyncedSha) {
        this.logger.log('Первая синхронизация, получаем все файлы из репозитория');
        await this.performInitialSync(latestSha);
        return;
      }

      // Получаем список изменённых файлов
      const changedFiles = await this.githubService.getChangedFiles(this.owner, this.repo, lastSyncedSha, latestSha);

      if (changedFiles.length === 0) {
        this.logger.debug('Нет изменённых файлов для синхронизации');
        // Обновляем SHA как последний синхронизированный
        await this.fileIndexRepository.upsert({
          coopname: this.coopname,
          entity_type: 'project',
          entity_hash: 'sync-marker',
          file_path: '.sync-marker',
          github_sha: latestSha,
        });
        return;
      }

      // Обрабатываем каждый изменённый файл
      for (const file of changedFiles) {
        await this.processChangedFile(file, latestSha);
      }

      this.logger.log('Синхронизация из GitHub завершена');
    } catch (error: any) {
      this.logger.error(`Ошибка синхронизации из GitHub: ${error.message}`, error.stack);
    }
  }

  /**
   * Первичная синхронизация всех файлов из репозитория
   */
  private async performInitialSync(sha: string): Promise<void> {
    this.logger.log('Выполнение первичной синхронизации');

    try {
      // Получаем дерево файлов
      const tree = await this.githubService.getTree(this.owner, this.repo, sha);

      // Фильтруем только .md файлы, исключая README.md
      const mdFiles = tree.filter(
        (item: any) => item.type === 'blob' && item.path.endsWith('.md') && item.path !== 'README.md'
      );

      if (mdFiles.length === 0) {
        this.logger.log('В репозитории нет файлов проектов для синхронизации');

        // Сохраняем SHA как последний синхронизированный, чтобы не повторять попытки
        await this.fileIndexRepository.upsert({
          coopname: this.coopname,
          entity_type: 'project',
          entity_hash: 'initial-sync-marker',
          file_path: '.sync-marker',
          github_sha: sha,
        });

        return;
      }

      for (const file of mdFiles) {
        try {
          const content = await this.githubService.getFileContent(this.owner, this.repo, file.path);
          await this.processChangedFile(
            {
              path: file.path,
              status: 'added',
              content,
            },
            sha
          );
        } catch (error: any) {
          this.logger.warn(`Ошибка обработки файла ${file.path}: ${error.message}`);
        }
      }

      this.logger.log('Первичная синхронизация завершена');
    } catch (error: any) {
      this.logger.error(`Ошибка первичной синхронизации: ${error.message}`);

      // Если репозиторий пустой, просто сохраняем маркер синхронизации
      await this.fileIndexRepository.upsert({
        coopname: this.coopname,
        entity_type: 'project',
        entity_hash: 'initial-sync-marker',
        file_path: '.sync-marker',
        github_sha: sha,
      });
    }
  }

  /**
   * Обработка изменённого файла
   */
  private async processChangedFile(file: any, currentSha: string): Promise<void> {
    // Пропускаем файлы, которые не являются markdown
    if (!file.path.endsWith('.md')) {
      return;
    }

    // Пропускаем файлы результатов - они синхронизируются только в одну сторону (DB → GitHub)
    if (file.path.includes('/results/')) {
      this.logger.debug(`Пропуск файла результата ${file.path} - односторонняя синхронизация`);
      return;
    }

    // Пропускаем README.md и другие служебные файлы
    if (file.path === 'README.md' || file.path.startsWith('.')) {
      return;
    }

    this.logger.debug(`Обработка файла ${file.path} (${file.status})`);

    // Обработка удаления файла
    if (file.status === 'removed') {
      await this.handleFileRemoval(file.path);
      return;
    }

    // Получаем содержимое файла
    const content = file.content || (await this.githubService.getFileContent(this.owner, this.repo, file.path));

    // Парсим markdown
    const data = this.fileFormatService.parseMarkdownFile(content);
    const { frontmatter, body } = data;

    // Определяем тип сущности
    const entityType = frontmatter.type;
    if (!entityType || !['project', 'issue', 'story'].includes(entityType)) {
      this.logger.warn(`Неизвестный тип сущности в файле ${file.path}: ${entityType}`);
      return;
    }

    // Обрабатываем переименование
    if (file.status === 'renamed' && file.previous_path) {
      await this.handleFileRename(entityType, frontmatter.hash, file.previous_path, file.path, content);
      return;
    }

    // Создаём или обновляем сущность
    const chairman = await this.getChairman();

    switch (entityType) {
      case 'project':
        await this.createOrUpdateProject(frontmatter, body, chairman);
        break;
      case 'issue':
        await this.createOrUpdateIssue(frontmatter, body, chairman);
        break;
      case 'story':
        await this.createOrUpdateStory(frontmatter, body, chairman);
        break;
    }

    // Обновляем индекс
    await this.fileIndexRepository.upsert({
      coopname: this.coopname,
      entity_type: entityType as any,
      entity_hash: frontmatter.hash,
      file_path: file.path,
      github_sha: currentSha,
    });
  }

  /**
   * Обработка удаления файла
   */
  private async handleFileRemoval(filePath: string): Promise<void> {
    this.logger.log(`Обработка удаления файла ${filePath}`);

    const index = await this.fileIndexRepository.findByPath(filePath, this.coopname);
    if (!index) {
      this.logger.debug(`Индекс для файла ${filePath} не найден`);
      return;
    }

    // TODO: Реализовать удаление сущностей при необходимости
    // Пока просто удаляем индекс
    await this.fileIndexRepository.deleteByHash(index.entity_type, index.entity_hash, this.coopname);
  }

  /**
   * Создать или обновить проект
   */
  private async createOrUpdateProject(frontmatter: any, body: string, chairman: MonoAccountDomainInterface): Promise<void> {
    const projectData = this.fileFormatService.markdownToProject(
      this.fileFormatService.generateMarkdownFile(frontmatter, body)
    );

    // Ищем существующий проект
    const existing = await this.projectRepository.findByHash(projectData.hash);

    if (existing) {
      // Проверяем, нужно ли обновление (по дате)
      const githubUpdatedAt = projectData.updated_at ? new Date(projectData.updated_at) : null;
      const dbUpdatedAt = existing._updated_at ? new Date(existing._updated_at) : null;

      if (githubUpdatedAt && dbUpdatedAt && githubUpdatedAt <= dbUpdatedAt) {
        this.logger.debug(`Проект ${projectData.hash} уже актуален в БД`);
        return;
      }

      // Обновляем проект
      this.logger.log(`Обновление проекта ${projectData.hash} из GitHub`);
      await this.projectManagementService.editProject({
        project_hash: projectData.hash,
        coopname: projectData.coopname,
        title: projectData.title,
        description: projectData.description,
        invite: existing.invite || '',
        data: existing.data || '',
        meta: existing.meta || '',
      });
    } else {
      // Создаём новый проект
      this.logger.log(`Создание нового проекта ${projectData.hash} из GitHub`);
      await this.projectManagementService.createProject(
        {
          project_hash: projectData.hash,
          coopname: projectData.coopname,
          title: projectData.title,
          description: projectData.description,
          parent_hash: projectData.parent_hash || '',
          invite: '',
          data: '',
          meta: '',
        },
        chairman
      );
    }
  }

  /**
   * Создать или обновить задачу
   */
  private async createOrUpdateIssue(frontmatter: any, body: string, chairman: MonoAccountDomainInterface): Promise<void> {
    const issueData = this.fileFormatService.markdownToIssue(
      this.fileFormatService.generateMarkdownFile(frontmatter, body)
    );

    // Ищем существующую задачу
    const existing = await this.issueRepository.findByIssueHash(issueData.hash);

    if (existing) {
      // Проверяем, нужно ли обновление
      const githubUpdatedAt = issueData.updated_at ? new Date(issueData.updated_at) : null;
      const dbUpdatedAt = existing._updated_at ? new Date(existing._updated_at) : null;

      if (githubUpdatedAt && dbUpdatedAt && githubUpdatedAt <= dbUpdatedAt) {
        this.logger.debug(`Задача ${issueData.hash} уже актуальна в БД`);
        return;
      }

      // Обновляем задачу
      this.logger.log(`Обновление задачи ${issueData.hash} из GitHub`);
      await this.generationService.updateIssue(
        {
          issue_hash: issueData.hash,
          title: issueData.title,
          description: issueData.description,
          priority: issueData.priority as any,
          status: issueData.status as any,
          estimate: issueData.estimate,
          labels: issueData.labels,
          submaster: issueData.submaster,
          creators: issueData.creators,
        },
        chairman.username,
        chairman
      );
    } else {
      // Создаём новую задачу
      this.logger.log(`Создание новой задачи ${issueData.hash} из GitHub`);
      await this.generationService.createIssue(
        {
          coopname: this.coopname,
          project_hash: issueData.project_hash,
          title: issueData.title,
          description: issueData.description,
          priority: issueData.priority as any,
          estimate: issueData.estimate,
          labels: issueData.labels,
        },
        chairman.username,
        chairman
      );
    }
  }

  /**
   * Создать или обновить требование
   */
  private async createOrUpdateStory(frontmatter: any, body: string, chairman: MonoAccountDomainInterface): Promise<void> {
    const storyData = this.fileFormatService.markdownToStory(
      this.fileFormatService.generateMarkdownFile(frontmatter, body)
    );

    // Ищем существующее требование
    const existing = await this.storyRepository.findByStoryHash(storyData.hash);

    if (existing) {
      // Проверяем, нужно ли обновление
      const githubUpdatedAt = storyData.updated_at ? new Date(storyData.updated_at) : null;
      const dbUpdatedAt = existing._updated_at ? new Date(existing._updated_at) : null;

      if (githubUpdatedAt && dbUpdatedAt && githubUpdatedAt <= dbUpdatedAt) {
        this.logger.debug(`Требование ${storyData.hash} уже актуально в БД`);
        return;
      }

      // Обновляем требование
      this.logger.log(`Обновление требования ${storyData.hash} из GitHub`);
      await this.generationService.updateStory(
        {
          story_hash: storyData.hash,
          title: storyData.title,
          description: storyData.description,
          status: storyData.status as any,
        },
        chairman.username
      );
    } else {
      // Создаём новое требование
      this.logger.log(`Создание нового требования ${storyData.hash} из GitHub`);
      await this.generationService.createStory(
        {
          story_hash: storyData.hash,
          coopname: this.coopname,
          project_hash: storyData.project_hash,
          issue_hash: storyData.issue_hash,
          title: storyData.title,
          description: storyData.description,
        },
        chairman
      );
    }
  }

  /**
   * Event handlers для синхронизации DB → GitHub
   */

  /**
   * Синхронизация результата в GitHub (DB → GitHub, только одностороння)
   * Результаты синхронизируются только из БД в GitHub, обратная синхронизация не поддерживается
   */
  async syncResultToGitHub(result: ResultDomainEntity): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('GitHub синхронизация отключена, пропускаем синхронизацию результата');
      return;
    }

    try {
      this.logger.debug(`Синхронизация результата ${result.result_hash} в GitHub`);

      // Получаем сегмент для дополнительной информации
      const segment = await this.segmentRepository.findOne({
        project_hash: result.project_hash,
        username: result.username,
      });

      if (!segment) {
        this.logger.warn(
          `Сегмент для проекта ${result.project_hash} и пользователя ${result.username} не найден, пропускаем синхронизацию результата`
        );
        return;
      }

      // Получаем проект для определения пути
      const project = await this.projectRepository.findByHash(result.project_hash || '');
      if (!project) {
        this.logger.warn(`Проект ${result.project_hash} не найден, пропускаем синхронизацию результата`);
        return;
      }

      // Определяем базовый путь в зависимости от того, является ли проект компонентом
      let basePath: string;
      if (project.isComponent()) {
        // Это компонент, нужно получить родительский проект
        const parentProject = await this.projectRepository.findByHash(project.parent_hash || '');
        if (!parentProject) {
          this.logger.warn(
            `Родительский проект ${project.parent_hash} не найден, пропускаем синхронизацию результата`
          );
          return;
        }
        const parentSlug = this.fileFormatService.generateSlug(parentProject.title || 'unnamed-project');
        const componentSlug = this.fileFormatService.generateSlug(project.title || 'unnamed-component');
        basePath = `${parentSlug}/components/${componentSlug}`;
      } else {
        // Это корневой проект
        basePath = this.fileFormatService.generateSlug(project.title || 'unnamed-project');
      }

      // Генерируем markdown файл
      const { content, slug } = this.fileFormatService.resultToMarkdown(result, segment);
      const filePath = `${basePath}/results/${slug}.md`;

      // Проверяем, нужно ли переименование (при переименовании проекта)
      const existingIndex = await this.fileIndexRepository.findByHash('result', result.result_hash, this.coopname);
      if (existingIndex && existingIndex.file_path !== filePath) {
        // Файл был перемещен в другую папку (проект переименован), удаляем старый
        await this.handleFileRename('result', result.result_hash, existingIndex.file_path, filePath, content);
        return;
      }

      // Получаем SHA существующего файла (если есть)
      const existingSha = await this.githubService.getFileSha(this.owner, this.repo, filePath);

      // Создаём или обновляем файл
      const commitMessage = existingSha
        ? `Update result: ${result.username} - ${result.result_hash}`
        : `Create result: ${result.username} - ${result.result_hash}`;

      const newSha = await this.githubService.createOrUpdateFile(
        this.owner,
        this.repo,
        filePath,
        content,
        commitMessage,
        existingSha || undefined
      );

      // Обновляем индекс
      await this.fileIndexRepository.upsert({
        coopname: this.coopname,
        entity_type: 'result',
        entity_hash: result.result_hash,
        file_path: filePath,
        github_sha: newSha,
      });

      this.logger.log(`Результат ${result.result_hash} успешно синхронизирован в GitHub`);
    } catch (error: any) {
      this.logger.error(
        `Ошибка синхронизации результата ${result.result_hash} в GitHub: ${error.message}`,
        error.stack
      );
    }
  }

  @OnEvent('project.created')
  @OnEvent('project.updated')
  async handleProjectChange(project: ProjectDomainEntity): Promise<void> {
    if (this.isEnabled()) {
      await this.syncProjectToGitHub(project);
    }
  }

  @OnEvent('issue.created')
  @OnEvent('issue.updated')
  async handleIssueChange(issue: IssueDomainEntity): Promise<void> {
    if (this.isEnabled()) {
      await this.syncIssueToGitHub(issue);
    }
  }

  @OnEvent('story.created')
  @OnEvent('story.updated')
  async handleStoryChange(story: StoryDomainEntity): Promise<void> {
    if (this.isEnabled()) {
      await this.syncStoryToGitHub(story);
    }
  }

  @OnEvent('result.updated')
  async handleResultChange(result: ResultDomainEntity): Promise<void> {
    if (this.isEnabled()) {
      await this.syncResultToGitHub(result);
    }
  }
}
