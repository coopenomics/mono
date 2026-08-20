import { Inject, Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { resolveCapitalGithubApiPlainToken } from '../../application/utils/capital-github-token';
import { SECRET_CIPHER_PORT, type ISecretCipherPort, INTEGRATION_SETTINGS_PORT, type IIntegrationSettingsPort } from '@coopenomics/innercoop';

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
  /** Чем разжать сохранённый токен и чем заменить, если своего нет. */
  private get tokenSources() {
    return {
      decrypt: (ciphertext: string) => this.secretCipher.decrypt(ciphertext),
      fallbackToken: this.integrations.get<{ token?: string }>('capital', 'github')?.token,
    };
  }

  private readonly logger = new Logger(GitHubService.name);
  private octokit: Octokit | null = null;

  constructor(
    @Inject(SECRET_CIPHER_PORT) private readonly secretCipher: ISecretCipherPort,
    @Inject(INTEGRATION_SETTINGS_PORT) private readonly integrations: IIntegrationSettingsPort
  ) {
    this.reconfigureWithCapitalExtensionEncrypted(undefined);
  }

  /**
   * После миграции/обновления конфига Capital: токен из поля `github_api_token_encrypted` или GITHUB_TOKEN.
   */
  reconfigureWithCapitalExtensionEncrypted(githubApiTokenEncrypted: string | undefined): void {
    const plain = resolveCapitalGithubApiPlainToken(githubApiTokenEncrypted, this.tokenSources);
    if (plain) {
      this.octokit = new Octokit({ auth: plain });
      this.logger.log('GitHub API инициализирован');
    } else {
      this.octokit = null;
      this.logger.warn('GitHub токен не установлен (ни в конфиге Capital, ни в GITHUB_TOKEN), API недоступен');
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
   * Получить SHA последнего коммита ветки (только чтение; репозиторий не изменяем).
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
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status === 404) {
        const msg = `Ветка «${branch}» не найдена в ${owner}/${repo}. Укажите существующую ветку; токен используется только на чтение, репозиторий не создаётся и не изменяется.`;
        this.logger.warn(msg);
        throw new Error(msg);
      }
      this.logger.error(`Ошибка получения последнего коммита: ${err.message ?? String(error)}`);
      throw error;
    }
  }

  /**
   * Имена всех веток репозитория (только чтение; пагинация по 100).
   */
  async listBranches(owner: string, repo: string): Promise<string[]> {
    const octokit = this.octokit;
    if (!octokit) throw new Error('GitHub API недоступен');

    const names: string[] = [];
    let page = 1;
    const perPage = 100;
    for (;;) {
      const rows = await this.withGithubRetry(async () => {
        const { data } = await octokit.repos.listBranches({ owner, repo, per_page: perPage, page });
        return data;
      });
      names.push(...rows.map((b) => b.name));
      if (rows.length < perPage) {
        break;
      }
      page += 1;
    }
    return names;
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
          return await this.createOrUpdateFile(owner, repo, path, content, message, freshSha, branch, false);
        }
      }

      // 422: файл уже существует, а sha не передали — подставляем актуальный blob-sha и повторяем
      const msg = String(error?.message ?? '');
      if (error.status === 422 && retryOnConflict && !sha && msg.includes('sha') && msg.includes("wasn't supplied")) {
        const freshSha = await this.getFileSha(owner, repo, path, branch);
        if (freshSha) {
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
   * Автор коммита (GitHub login). Для GitHub Sync пока не используется в проверке прав;
   * оставлено для будущего GitHub App и привязки логина к пользователю кооператива.
   */
  async getCommitAuthorLogin(owner: string, repo: string, commitSha: string): Promise<string | null> {
    if (!this.octokit) throw new Error('GitHub API недоступен');

    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: commitSha,
      });
      return data.author?.login ?? null;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Не удалось получить автора коммита ${commitSha}: ${msg}`);
      return null;
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

  /**
   * Все коммиты ветки (история до HEAD), от старых к новым.
   * Используется для первичной индексации маркеров (PRD: не только с момента включения).
   */
  async listAllCommitsOnBranchOldestFirst(
    owner: string,
    repo: string,
    branch: string,
    signal?: AbortSignal
  ): Promise<{ sha: string; parents: string[]; commit: { message: string; author: { date?: string } | null } }[]> {
    const octokit = this.octokit;
    if (!octokit) throw new Error('GitHub API недоступен');

    const newestFirst: { sha: string; parents: string[]; commit: { message: string; author: { date?: string } | null } }[] = [];
    let page = 1;
    const perPage = 100;

    for (;;) {
      if (signal?.aborted) {
        const err = new Error('Синхронизация Git прервана');
        err.name = 'AbortError';
        throw err;
      }

      const pageRows = await this.withGithubRetry(async () => {
        const { data } = await octokit.repos.listCommits({
          owner,
          repo,
          sha: branch,
          per_page: perPage,
          page,
        });
        return data;
      });

      if (!pageRows.length) {
        break;
      }

      for (const c of pageRows) {
        newestFirst.push({
          sha: c.sha,
          parents: (c.parents ?? []).map((p) => (typeof p === 'string' ? p : p.sha)),
          commit: {
            message: c.commit?.message ?? '',
            author: c.commit?.author ?? null,
          },
        });
      }

      if (pageRows.length < perPage) {
        break;
      }
      page += 1;
    }

    return newestFirst.slice().reverse();
  }

  /**
   * Коммиты, появившиеся между base и head (не включая предков base). Порядок — от старых к новым (как в GitHub compare).
   */
  async listCommitsBetweenBaseAndHead(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string
  ): Promise<{ sha: string; parents: string[]; commit: { message: string; author: { date?: string } | null } }[]> {
    if (!this.octokit) throw new Error('GitHub API недоступен');
    return this.withGithubRetry(async () => {
      const { data } = await this.octokit!.repos.compareCommitsWithBasehead({
        owner,
        repo,
        basehead: `${baseSha}...${headSha}`,
      });
      const list = data.commits || [];
      return list.map((c) => ({
        sha: c.sha,
        parents: (c.parents || []).map((p) => (typeof p === 'string' ? p : p.sha)),
        commit: {
          message: c.commit.message || '',
          author: c.commit.author,
        },
      }));
    });
  }

  /** Текстовая склейка patch-фрагментов файлов коммита (для RID / взноса). */
  async getCommitPatchesConcat(owner: string, repo: string, commitSha: string): Promise<string> {
    if (!this.octokit) throw new Error('GitHub API недоступен');
    return this.withGithubRetry(async () => {
      const { data } = await this.octokit!.repos.getCommit({
        owner,
        repo,
        ref: commitSha,
      });
      const files = data.files || [];
      const parts: string[] = [];
      for (const f of files) {
        if (f.patch) {
          parts.push(`--- ${f.filename}\n${f.patch}`);
        }
      }
      return parts.join('\n\n');
    });
  }

  private async withGithubRetry<T>(fn: () => Promise<T>): Promise<T> {
    const max = 3;
    let last: unknown;
    for (let attempt = 0; attempt < max; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        last = error;
        const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: number }).status : undefined;
        if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
          await sleepMs(250 * 2 ** attempt);
          continue;
        }
        throw error;
      }
    }
    throw last instanceof Error ? last : new Error(String(last));
  }
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
