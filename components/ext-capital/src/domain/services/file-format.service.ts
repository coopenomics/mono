import { Injectable, Logger } from '@nestjs/common';
import type { ProjectDomainEntity } from '../entities/project.entity';
import type { IssueDomainEntity } from '../entities/issue.entity';
import type { StoryDomainEntity } from '../entities/story.entity';
import type { ResultDomainEntity } from '../entities/result.entity';
import type { SegmentDomainEntity } from '../entities/segment.entity';

/**
 * Интерфейс для результата парсинга markdown
 */
export interface ParsedMarkdown {
  frontmatter: Record<string, any>;
  body: string;
}

/**
 * Интерфейс для данных проекта из markdown
 */
export interface ProjectMarkdownData {
  type: 'project';
  title: string;
  hash: string;
  parent_hash?: string;
  coopname: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Интерфейс для данных задачи из markdown
 */
export interface IssueMarkdownData {
  type: 'issue';
  title: string;
  id: string;
  hash: string;
  project_hash: string;
  cycle_id?: string;
  status: string;
  priority: string;
  estimate: number;
  created_by: string;
  submaster?: string;
  creators: string[];
  labels: string[];
  description: string;
  created_at?: string;
  updated_at?: string;
  sort_order: number;
}

/**
 * Интерфейс для данных требования из markdown
 */
export interface StoryMarkdownData {
  type: 'story';
  title: string;
  hash: string;
  project_hash?: string;
  issue_hash?: string;
  status: string;
  created_by: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  sort_order: number;
}

/**
 * Интерфейс для данных результата из markdown
 */
export interface ResultMarkdownData {
  type: 'result';
  result_hash: string;
  username: string;
  project_hash: string;
  status: string;
  total_amount?: string;
  debt_amount?: string;
  contribution_amount?: string;
  statement_hash?: string;
  description: string;
  created_at?: string;
}

/**
 * Сервис для работы с форматом markdown файлов
 * Обрабатывает конвертацию между доменными сущностями и markdown файлами с YAML frontmatter
 */
@Injectable()
export class FileFormatService {
  private readonly logger = new Logger(FileFormatService.name);

  /**
   * Парсит markdown файл с YAML frontmatter
   * Использует простой парсер вместо gray-matter для избежания зависимостей
   */
  parseMarkdownFile(content: string): ParsedMarkdown {
    const lines = content.split('\n');

    // Проверяем наличие frontmatter
    if (lines[0] !== '---') {
      return {
        frontmatter: {},
        body: content,
      };
    }

    // Ищем конец frontmatter
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
    if (endIndex === -1) {
      return {
        frontmatter: {},
        body: content,
      };
    }

    // Извлекаем YAML frontmatter
    const yamlLines = lines.slice(1, endIndex);
    const frontmatter: Record<string, any> = {};

    for (const line of yamlLines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value: any = match[2].trim();

        // Обработка массивов
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map((v: string) => v.trim());
        }
        // Обработка чисел
        else if (!isNaN(Number(value))) {
          value = Number(value);
        }

        frontmatter[key] = value;
      }
    }

    // Извлекаем body
    const body = lines.slice(endIndex + 1).join('\n').trim();

    return { frontmatter, body };
  }

  /**
   * Генерирует markdown файл с YAML frontmatter
   */
  generateMarkdownFile(frontmatter: Record<string, any>, body: string): string {
    const yamlLines = ['---'];

    for (const [key, value] of Object.entries(frontmatter)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        yamlLines.push(`${key}: [${value.join(', ')}]`);
      } else {
        yamlLines.push(`${key}: ${value}`);
      }
    }

    yamlLines.push('---');
    yamlLines.push('');
    yamlLines.push(body);

    return yamlLines.join('\n');
  }

  /**
   * Таблица транслитерации русских букв в английские
   */
  private readonly transliterationMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };

  /**
   * Транслитерирует русский текст в английский
   */
  private transliterate(text: string): string {
    return text
      .toLowerCase()
      .split('')
      .map(char => this.transliterationMap[char] || char)
      .join('');
  }

  /**
   * Проверяет, содержит ли текст русские буквы
   */
  private hasCyrillic(text: string): boolean {
    return /[а-яё]/i.test(text);
  }

  /**
   * Генерирует slug из заголовка
   * Для русских названий делает транслитерацию в английский
   */
  generateSlug(title: string): string {
    let processedTitle = title;

    // Если название содержит русские буквы - транслитерируем
    if (this.hasCyrillic(title)) {
      processedTitle = this.transliterate(title);
    }

    return processedTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Удаляем все не английские буквы, цифры, пробелы и дефисы
      .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
      .replace(/-+/g, '-') // Удаляем множественные дефисы
      .replace(/^-|-$/g, ''); // Удаляем дефисы в начале и конце
  }

  /**
   * Конвертирует проект в markdown
   */
  projectToMarkdown(project: ProjectDomainEntity): { content: string; slug: string } {
    const slug = this.generateSlug(project.title || 'unnamed-project');

    const frontmatter: Record<string, any> = {
      type: 'project',
      title: project.title,
      hash: project.project_hash,
      coopname: project.coopname,
    };

    if (project.parent_hash) {
      frontmatter.parent_hash = project.parent_hash;
    }

    if (project.created_at) {
      frontmatter.created_at = new Date(project.created_at).toISOString();
    }

    if (project._updated_at) {
      frontmatter.updated_at = new Date(project._updated_at).toISOString();
    }

    const body = project.description || '';
    const content = this.generateMarkdownFile(frontmatter, body);

    return { content, slug };
  }

  /**
   * Конвертирует markdown в данные проекта
   */
  markdownToProject(content: string): ProjectMarkdownData {
    const { frontmatter, body } = this.parseMarkdownFile(content);

    return {
      type: 'project',
      title: frontmatter.title,
      hash: frontmatter.hash,
      parent_hash: frontmatter.parent_hash,
      coopname: frontmatter.coopname,
      description: body,
      created_at: frontmatter.created_at,
      updated_at: frontmatter.updated_at,
    };
  }

  /**
   * Конвертирует задачу в markdown
   */
  issueToMarkdown(issue: IssueDomainEntity): { content: string; slug: string } {
    const slug = this.generateSlug(issue.title);

    const frontmatter: Record<string, any> = {
      type: 'issue',
      title: issue.title,
      id: issue.id,
      hash: issue.issue_hash,
      project_hash: issue.project_hash,
      status: issue.status,
      priority: issue.priority,
      estimate: issue.estimate,
      created_by: issue.created_by,
      creators: issue.creators,
      labels: issue.metadata?.labels || [],
      sort_order: issue.sort_order,
    };

    if (issue.cycle_id) {
      frontmatter.cycle_id = issue.cycle_id;
    }

    if (issue.submaster) {
      frontmatter.submaster = issue.submaster;
    }

    if (issue._created_at) {
      frontmatter.created_at = new Date(issue._created_at).toISOString();
    }

    if (issue._updated_at) {
      frontmatter.updated_at = new Date(issue._updated_at).toISOString();
    }

    const body = issue.description || '';
    const content = this.generateMarkdownFile(frontmatter, body);

    return { content, slug };
  }

  /**
   * Конвертирует markdown в данные задачи
   */
  markdownToIssue(content: string): IssueMarkdownData {
    const { frontmatter, body } = this.parseMarkdownFile(content);

    return {
      type: 'issue',
      title: frontmatter.title,
      id: frontmatter.id,
      hash: frontmatter.hash,
      project_hash: frontmatter.project_hash,
      cycle_id: frontmatter.cycle_id,
      status: frontmatter.status,
      priority: frontmatter.priority,
      estimate: frontmatter.estimate,
      created_by: frontmatter.created_by,
      submaster: frontmatter.submaster,
      creators: frontmatter.creators || [],
      labels: frontmatter.labels || [],
      description: body,
      created_at: frontmatter.created_at,
      updated_at: frontmatter.updated_at,
      sort_order: frontmatter.sort_order || 0,
    };
  }

  /**
   * Конвертирует требование в markdown
   */
  storyToMarkdown(story: StoryDomainEntity): { content: string; slug: string } {
    const slug = this.generateSlug(story.title);

    const frontmatter: Record<string, any> = {
      type: 'story',
      title: story.title,
      hash: story.story_hash,
      status: story.status,
      created_by: story.created_by,
      sort_order: story.sort_order,
    };

    if (story.project_hash) {
      frontmatter.project_hash = story.project_hash;
    }

    if (story.issue_hash) {
      frontmatter.issue_hash = story.issue_hash;
    }

    if (story._created_at) {
      frontmatter.created_at = new Date(story._created_at).toISOString();
    }

    if (story._updated_at) {
      frontmatter.updated_at = new Date(story._updated_at).toISOString();
    }

    const body = story.description || '';
    const content = this.generateMarkdownFile(frontmatter, body);

    return { content, slug };
  }

  /**
   * Конвертирует markdown в данные требования
   */
  markdownToStory(content: string): StoryMarkdownData {
    const { frontmatter, body } = this.parseMarkdownFile(content);

    return {
      type: 'story',
      title: frontmatter.title,
      hash: frontmatter.hash,
      project_hash: frontmatter.project_hash,
      issue_hash: frontmatter.issue_hash,
      status: frontmatter.status,
      created_by: frontmatter.created_by,
      description: body,
      created_at: frontmatter.created_at,
      updated_at: frontmatter.updated_at,
      sort_order: frontmatter.sort_order || 0,
    };
  }

  /**
   * Генерирует путь к файлу проекта
   */
  generateProjectPath(project: ProjectDomainEntity): string {
    const slug = this.generateSlug(project.title || 'unnamed-project');

    // Если проект является компонентом (имеет parent_hash), то он находится в подпапке components
    if (project.parent_hash) {
      // Найти родительский проект (это требует доступа к репозиторию, поэтому пока оставим как есть)
      // В идеале нужно передавать parent project
      return `${slug}/component.md`;
    }

    return `${slug}/project.md`;
  }

  /**
   * Генерирует путь к файлу задачи
   */
  generateIssuePath(issue: IssueDomainEntity, projectSlug: string): string {
    const slug = this.generateSlug(issue.title);
    return `${projectSlug}/issues/${slug}.md`;
  }

  /**
   * Генерирует путь к файлу требования
   */
  generateStoryPath(story: StoryDomainEntity, projectSlug: string, issueSlug?: string): string {
    const slug = this.generateSlug(story.title);

    if (issueSlug) {
      return `${projectSlug}/issues/${issueSlug}-requirements/${slug}.md`;
    }

    return `${projectSlug}/requirements/${slug}.md`;
  }

  /**
   * Конвертирует результат в markdown
   * Результаты сохраняются в папку results проекта/компонента
   */
  resultToMarkdown(result: ResultDomainEntity, segment: SegmentDomainEntity): { content: string; slug: string } {
    // Используем result_hash в качестве имени файла для уникальности
    const slug = result.result_hash;

    const frontmatter: Record<string, any> = {
      type: 'result',
      result_hash: result.result_hash,
      username: result.username,
      project_hash: result.project_hash,
      status: result.status,
    };

    // Добавляем финансовые данные из сегмента
    if (segment.total_segment_cost) {
      frontmatter.contribution_amount = segment.total_segment_cost;
    }

    if (segment.debt_amount) {
      frontmatter.debt_amount = segment.debt_amount;
    }

    if (result.total_amount) {
      frontmatter.total_amount = result.total_amount;
    }

    // Добавляем хэш заявления, если есть
    if (result.statement?.hash) {
      frontmatter.statement_hash = result.statement.hash;
    }

    if (result.created_at) {
      frontmatter.created_at = new Date(result.created_at).toISOString();
    }

    // Формируем описание с деталями результата
    const descriptionParts: string[] = [];

    if (segment.total_segment_cost) {
      descriptionParts.push(`**Размер вклада:** ${segment.total_segment_cost}`);
    }
    descriptionParts.push('');
    if (segment.debt_amount) {
      descriptionParts.push(`**Размер займа:** ${segment.debt_amount}`);
    }
    descriptionParts.push('');
    if (result.total_amount) {
      descriptionParts.push(`**Итоговая сумма:** ${result.total_amount}`);
    }
    descriptionParts.push('');
    // Добавляем информацию о ролях участника
    const roles: string[] = [];
    if (segment.is_author) roles.push('Автор');
    if (segment.is_creator) roles.push('Создатель');
    if (segment.is_coordinator) roles.push('Координатор');
    if (segment.is_investor) roles.push('Инвестор');
    if (segment.is_contributor) roles.push('Участник');
    if (segment.is_propertor) roles.push('Собственник');

    if (roles.length > 0) {
      descriptionParts.push(`**Роли в проекте:** ${roles.join(', ')}`);
    }

    // Добавляем информацию о заявлении
    if (result.statement) {
      descriptionParts.push('');
      descriptionParts.push('## Заявление');
      descriptionParts.push(`- **Хэш документа:** ${result.statement.doc_hash}`);
      if (result.statement.meta) {
        descriptionParts.push(`- **Публичный ключ:** ${result.statement.signatures[0].public_key}`);
        descriptionParts.push(`- **Подпись:** ${result.statement.signatures[0].signature}`);
      }
    }
    descriptionParts.push(result.data ?? '');
    const body = descriptionParts.join('\n');
    const content = this.generateMarkdownFile(frontmatter, body);

    return { content, slug };
  }

  /**
   * Генерирует путь к файлу результата
   */
  generateResultPath(result: ResultDomainEntity, projectSlug: string): string {
    const slug = result.result_hash;
    return `${projectSlug}/results/${slug}.md`;
  }
}
