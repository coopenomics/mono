import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { config } from '~/config';

/**
 * Интерфейс для измененного файла
 */
export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  content?: string;
  previous_path?: string; // для переименованных файлов
}

/**
 * Сервис для работы с GitHub API через Octokit
 */
@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private octokit: Octokit | null = null;

  constructor() {
    if (config.github.token) {
      this.octokit = new Octokit({
        auth: config.github.token,
      });
      this.logger.log('GitHub API инициализирован');
    } else {
      this.logger.warn('GitHub токен не установлен, синхронизация с GitHub недоступна');
    }
  }

  /**
   * Проверить, доступен ли GitHub API
   */
  isAvailable(): boolean {
    return this.octokit !== null;
  }

  /**
   * Проверить существование ветки
   */
  async branchExists(owner: string, repo: string, branch = 'main'): Promise<boolean> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      await this.octokit.repos.getBranch({
        owner,
        repo,
        branch,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Создать начальный коммит в пустом репозитории
   */
  async createInitialCommit(owner: string, repo: string, branch = 'main'): Promise<string> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      this.logger.log(`Создание начального коммита в репозитории ${owner}/${repo}`);

      // Создаём начальный README.md
      const readmeContent = `# ${repo}\n\nРепозиторий для синхронизации проектов кооператива.\n`;
      const contentEncoded = Buffer.from(readmeContent, 'utf-8').toString('base64');

      // Создаём файл, который автоматически создаст ветку
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'README.md',
        message: 'Initial commit',
        content: contentEncoded,
        branch,
      });

      this.logger.log(`Начальный коммит создан: ${data.commit.sha}`);
      return data.commit.sha || '';
    } catch (error: any) {
      this.logger.error(`Ошибка создания начального коммита: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить последний коммит из ветки
   */
  async getLatestCommit(owner: string, repo: string, branch = 'main'): Promise<string> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      const { data } = await this.octokit.repos.getBranch({
        owner,
        repo,
        branch,
      });
      return data.commit.sha;
    } catch (error: any) {
      // Если ветка не найдена, создаём начальный коммит
      if (error.status === 404) {
        this.logger.warn(`Ветка ${branch} не найдена в репозитории ${owner}/${repo}, создаём начальный коммит`);
        return await this.createInitialCommit(owner, repo, branch);
      }
      this.logger.error(`Ошибка получения последнего коммита: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить содержимое файла
   */
  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(data)) {
        throw new Error(`Путь ${path} является директорией`);
      }

      if (data.type !== 'file') {
        throw new Error(`Путь ${path} не является файлом`);
      }

      // Декодируем содержимое из base64
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return content;
    } catch (error: any) {
      this.logger.error(`Ошибка получения содержимого файла ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить список изменённых файлов между коммитами
   */
  async getChangedFiles(owner: string, repo: string, baseSha: string, headSha: string): Promise<ChangedFile[]> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      const { data } = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base: baseSha,
        head: headSha,
      });

      const changedFiles: ChangedFile[] = [];

      for (const file of data.files || []) {
        const changedFile: ChangedFile = {
          path: file.filename,
          status: file.status as any,
        };

        // Для переименованных файлов сохраняем старый путь
        if (file.status === 'renamed' && file.previous_filename) {
          changedFile.previous_path = file.previous_filename;
        }

        // Получаем содержимое для добавленных и изменённых файлов
        if (file.status === 'added' || file.status === 'modified') {
          try {
            changedFile.content = await this.getFileContent(owner, repo, file.filename, headSha);
          } catch (error) {
            this.logger.warn(`Не удалось получить содержимое файла ${file.filename}: ${error}`);
          }
        }

        changedFiles.push(changedFile);
      }

      return changedFiles;
    } catch (error: any) {
      // Если один из коммитов не найден, возвращаем пустой массив
      if (error.status === 404) {
        this.logger.warn(`Один из коммитов не найден при сравнении ${baseSha}...${headSha}`);
        return [];
      }
      this.logger.error(`Ошибка получения изменённых файлов: ${error.message}`);
      throw error;
    }
  }

  /**
   * Создать или обновить файл
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch = 'main',
    retryOnConflict = true
  ): Promise<string> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      const contentEncoded = Buffer.from(content, 'utf-8').toString('base64');

      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: contentEncoded,
        sha,
        branch,
      });

      return data.commit.sha || '';
    } catch (error: any) {
      // При конфликте SHA (409) повторяем попытку со свежим SHA
      if (error.status === 409 && retryOnConflict) {
        const freshSha = await this.getFileSha(owner, repo, path, branch);
        if (freshSha) {
          // Рекурсивный вызов с свежим SHA, но без повторных попыток
          return await this.createOrUpdateFile(owner, repo, path, content, message, freshSha, branch, false);
        }
      }

      this.logger.error(`Ошибка создания/обновления файла ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Удалить файл
   */
  async deleteFile(owner: string, repo: string, path: string, message: string, sha: string, branch = 'main'): Promise<void> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      await this.octokit.repos.deleteFile({
        owner,
        repo,
        path,
        message,
        sha,
        branch,
      });
    } catch (error: any) {
      this.logger.error(`Ошибка удаления файла ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить дерево файлов
   */
  async getTree(owner: string, repo: string, sha: string): Promise<any[]> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      const { data } = await this.octokit.git.getTree({
        owner,
        repo,
        tree_sha: sha,
        recursive: 'true',
      });
      return data.tree || [];
    } catch (error: any) {
      // Если репозиторий пустой или дерево не найдено, возвращаем пустой массив
      if (error.status === 404 || error.status === 409) {
        this.logger.warn(`Дерево файлов пустое или не найдено: ${error.message}`);
        return [];
      }
      this.logger.error(`Ошибка получения дерева файлов: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить SHA файла для обновления
   */
  async getFileSha(owner: string, repo: string, path: string, branch = 'main'): Promise<string | null> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      return data.sha;
    } catch (error: any) {
      // Если файл не найден, возвращаем null
      if (error.status === 404) {
        return null;
      }
      this.logger.error(`Ошибка получения SHA файла ${path}: ${error.message}`);
      throw error;
    }
  }
}
