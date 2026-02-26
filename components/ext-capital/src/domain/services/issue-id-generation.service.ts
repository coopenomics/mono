import { Injectable } from '@nestjs/common';
import { ProjectDomainEntity } from '../entities/project.entity';
import type { IIssueDatabaseData } from '../interfaces/issue-database.interface';

/**
 * Доменный сервис для генерации ID задач
 *
 * Отвечает за бизнес-логику генерации уникальных последовательных ID задач
 * в рамках проектов согласно требованиям чистой архитектуры
 */
@Injectable()
export class IssueIdGenerationService {
  /**
   * Генерирует префикс проекта из его хэша
   *
   * @param projectHash - хэш проекта
   * @returns префикс в верхнем регистре
   */
  static generateProjectPrefix(projectHash: string): string {
    return projectHash.substring(0, 3).toUpperCase();
  }

  /**
   * Генерирует префикс проекта из его хэша (экземплярный метод)
   *
   * @param projectHash - хэш проекта
   * @returns префикс в верхнем регистре
   */
  generateProjectPrefix(projectHash: string): string {
    return IssueIdGenerationService.generateProjectPrefix(projectHash);
  }

  /**
   * Инициализирует поля для генерации ID задач в проекте
   *
   * @param project - доменная сущность проекта
   */
  initializeProjectIssueFields(project: ProjectDomainEntity): void {
    if (!project.prefix) {
      project.prefix = this.generateProjectPrefix(project.project_hash);
    }
    if (project.issue_counter === undefined || project.issue_counter === null) {
      project.issue_counter = 0;
    }
  }

  /**
   * Генерирует следующий ID для задачи в рамках проекта
   *
   * @param project - доменная сущность проекта
   * @param issueData - данные задачи без ID
   * @returns объект с новым ID, обновленными данными задачи и обновленным проектом
   */
  generateIssueId(
    project: ProjectDomainEntity,
    issueData: Omit<IIssueDatabaseData, 'id'>
  ): { issueId: string; issueData: IIssueDatabaseData; updatedProject: ProjectDomainEntity } {
    // Инициализируем поля проекта если нужно
    this.initializeProjectIssueFields(project);
    
    // Увеличиваем счетчик задач в проекте
    const nextIssueNumber = project.issue_counter + 1;

    // Генерируем ID в формате PREFIX-N
    const issueId = `${project.prefix}-${nextIssueNumber}`;

    // Создаем полные данные задачи с новым ID
    const fullIssueData: IIssueDatabaseData = {
      ...issueData,
      id: issueId,
    };
    
    // Обновляем счетчик в проекте (атомарно в рамках метода)
    project.issue_counter = nextIssueNumber;

    return {
      issueId,
      issueData: fullIssueData,
      updatedProject: project,
    };
  }

  /**
   * Получает следующий ID без изменения состояния проекта
   *
   * @param project - доменная сущность проекта
   * @returns следующий ID в формате PREFIX-N
   */
  getNextIssueId(project: ProjectDomainEntity): string {
    const nextIssueNumber = project.issue_counter + 1;
    return `${project.prefix}-${nextIssueNumber}`;
  }

  /**
   * Валидирует формат ID задачи
   *
   * @param issueId - ID задачи для валидации
   * @param project - проект для проверки соответствия префикса
   * @returns true если ID валиден
   */
  validateIssueId(issueId: string, project: ProjectDomainEntity): boolean {
    const expectedPrefix = project.prefix;
    const regex = new RegExp(`^${expectedPrefix}-\\d+$`);
    return regex.test(issueId);
  }

  /**
   * Извлекает номер задачи из ID
   *
   * @param issueId - ID задачи в формате PREFIX-N
   * @returns номер задачи или null если формат неверный
   */
  extractIssueNumber(issueId: string): number | null {
    const match = issueId.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }
}
