import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import config from '~/config/config';

/**
 * Тип Git-источника
 */
export enum GitSourceType {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
  UNKNOWN = 'unknown',
}

/**
 * Тип Git-ссылки
 */
export enum GitRefType {
  PULL_REQUEST = 'pull_request',
  COMMIT = 'commit',
  MERGE_REQUEST = 'merge_request',
}

/**
 * Интерфейс данных извлеченных из Git
 */
export interface IGitDiffData {
  /** Исходный URL */
  url: string;
  /** Тип источника (GitHub, GitLab и т.д.) */
  source: GitSourceType;
  /** Тип ссылки (PR, commit и т.д.) */
  type: GitRefType;
  /** Diff-патч */
  diff: string;
  /** Владелец репозитория */
  owner: string;
  /** Название репозитория */
  repo: string;
  /** Референс (номер PR/MR или SHA коммита) */
  ref: string;
  /** Дата извлечения */
  extracted_at: string;
}

/**
 * Парсинг URL для извлечения информации о репозитории
 */
interface IParsedGitUrl {
  source: GitSourceType;
  type: GitRefType;
  owner: string;
  repo: string;
  ref: string;
}

/**
 * Сервис для работы с Git-источниками
 * Поддерживает извлечение diff-патчей из различных Git-провайдеров
 */
@Injectable()
export class GitService {
  private octokit: Octokit;

  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext(GitService.name);

    // Инициализация Octokit с токеном из конфигурации (опционально)
    const githubToken = config.github.token;
    this.octokit = new Octokit({
      auth: githubToken,
    });

    if (githubToken) {
      this.logger.debug('GitHub токен найден, будет использован для аутентификации');
    } else {
      this.logger.debug('GitHub токен не найден, будут использоваться только публичные репозитории');
    }
  }

  /**
   * Извлечение diff-патча из Git URL
   * @param url - URL на PR, MR или коммит
   * @returns Данные с diff-патчем
   */
  async extractDiffFromUrl(url: string): Promise<IGitDiffData> {
    this.logger.debug(`Извлечение diff из URL: ${url}`);

    // Парсим URL
    const parsed = this.parseGitUrl(url);

    // В зависимости от источника вызываем соответствующий метод
    switch (parsed.source) {
      case GitSourceType.GITHUB:
        return await this.extractFromGitHub(url, parsed);
      case GitSourceType.GITLAB:
        throw new Error('GitLab пока не поддерживается. Используйте GitHub.');
      case GitSourceType.BITBUCKET:
        throw new Error('Bitbucket пока не поддерживается. Используйте GitHub.');
      default:
        throw new Error('Неизвестный Git-источник. Поддерживаются только GitHub URL.');
    }
  }

  /**
   * Парсинг Git URL для определения источника и типа
   * @param url - URL для парсинга
   * @returns Распарсенные данные
   */
  private parseGitUrl(url: string): IParsedGitUrl {
    // GitHub patterns
    // PR: https://github.com/owner/repo/pull/123
    // Commit: https://github.com/owner/repo/commit/abc123
    const githubPrPattern = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
    const githubCommitPattern = /github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)/;

    // GitLab patterns (для будущего)
    const gitlabMrPattern = /gitlab\.com\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/;
    const gitlabCommitPattern = /gitlab\.com\/([^/]+)\/([^/]+)\/-\/commit\/([a-f0-9]+)/;

    // Проверяем GitHub PR
    let match = url.match(githubPrPattern);
    if (match) {
      return {
        source: GitSourceType.GITHUB,
        type: GitRefType.PULL_REQUEST,
        owner: match[1],
        repo: match[2],
        ref: match[3],
      };
    }

    // Проверяем GitHub Commit
    match = url.match(githubCommitPattern);
    if (match) {
      return {
        source: GitSourceType.GITHUB,
        type: GitRefType.COMMIT,
        owner: match[1],
        repo: match[2],
        ref: match[3],
      };
    }

    // Проверяем GitLab MR
    match = url.match(gitlabMrPattern);
    if (match) {
      return {
        source: GitSourceType.GITLAB,
        type: GitRefType.MERGE_REQUEST,
        owner: match[1],
        repo: match[2],
        ref: match[3],
      };
    }

    // Проверяем GitLab Commit
    match = url.match(gitlabCommitPattern);
    if (match) {
      return {
        source: GitSourceType.GITLAB,
        type: GitRefType.COMMIT,
        owner: match[1],
        repo: match[2],
        ref: match[3],
      };
    }

    throw new Error(
      'Не удалось распарсить Git URL. Поддерживаемые форматы:\n' +
        '- GitHub PR: https://github.com/owner/repo/pull/123\n' +
        '- GitHub Commit: https://github.com/owner/repo/commit/abc123'
    );
  }

  /**
   * Извлечение diff из GitHub
   * @param url - Исходный URL
   * @param parsed - Распарсенные данные
   * @returns Данные с diff-патчем
   */
  private async extractFromGitHub(url: string, parsed: IParsedGitUrl): Promise<IGitDiffData> {
    try {
      let diff: string;

      if (parsed.type === GitRefType.PULL_REQUEST) {
        // Получаем diff для Pull Request
        this.logger.debug(
          `Запрос diff для PR #${parsed.ref} из ${parsed.owner}/${parsed.repo}`
        );

        const { data } = await this.octokit.pulls.get({
          owner: parsed.owner,
          repo: parsed.repo,
          pull_number: parseInt(parsed.ref, 10),
          mediaType: {
            format: 'diff',
          },
        });

        diff = data as unknown as string;
      } else if (parsed.type === GitRefType.COMMIT) {
        // Получаем diff для коммита
        this.logger.debug(
          `Запрос diff для коммита ${parsed.ref} из ${parsed.owner}/${parsed.repo}`
        );

        const { data } = await this.octokit.repos.getCommit({
          owner: parsed.owner,
          repo: parsed.repo,
          ref: parsed.ref,
          mediaType: {
            format: 'diff',
          },
        });

        diff = data as unknown as string;
      } else {
        throw new Error(`Неподдерживаемый тип ссылки: ${parsed.type}`);
      }

      if (!diff || diff.trim().length === 0) {
        throw new Error('Получен пустой diff. Проверьте правильность URL.');
      }

      this.logger.debug(`Успешно извлечен diff (${diff.length} символов)`);

      return {
        url,
        source: parsed.source,
        type: parsed.type,
        diff,
        owner: parsed.owner,
        repo: parsed.repo,
        ref: parsed.ref,
        extracted_at: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Ошибка при извлечении diff из GitHub: ${error?.message}`, error?.stack);

      // Улучшенная обработка ошибок
      if (error?.status === 404) {
        throw new Error(
          `PR/коммит не найден. Проверьте правильность URL и доступность репозитория.`
        );
      } else if (error?.status === 401 || error?.status === 403) {
        throw new Error(
          `Отсутствует доступ к репозиторию. Для приватных репозиториев необходим GITHUB_TOKEN.`
        );
      } else {
        throw new Error(`Не удалось получить diff из GitHub: ${error?.message}`);
      }
    }
  }

  /**
   * Проверка, является ли строка Git URL
   * @param data - Строка для проверки
   * @returns true, если строка является Git URL
   */
  isGitUrl(data: string): boolean {
    if (!data || typeof data !== 'string') {
      return false;
    }

    // Проверяем наличие паттернов Git URL
    const gitPatterns = [
      /github\.com\/([^/]+)\/([^/]+)\/(pull|commit)/,
      /gitlab\.com\/([^/]+)\/([^/]+)\/-\/(merge_requests|commit)/,
      /bitbucket\.org\/([^/]+)\/([^/]+)\/(pull-requests|commits)/,
    ];

    return gitPatterns.some((pattern) => pattern.test(data));
  }
}
