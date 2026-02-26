import { ProcessTemplateStatus } from '../enums/process-status.enum';

/**
 * Шаблон процесса — описывает структуру процесса (шаги и связи).
 * Создаётся chairman/member. Привязан к компоненту.
 */
export class ProcessTemplateDomainEntity {
  public id!: string;
  public coopname!: string;
  public project_hash!: string;
  public title!: string;
  public description?: string;
  public status!: ProcessTemplateStatus;
  public created_by!: string;
  public created_at!: Date;
  public updated_at!: Date;

  /**
   * Шаги процесса — узлы Vue Flow.
   * Каждый шаг = шаблон задачи с позицией на холсте.
   */
  public steps!: ProcessStepTemplate[];

  /**
   * Связи между шагами — рёбра Vue Flow.
   * source → target: target создаётся после завершения source.
   */
  public edges!: ProcessEdge[];
}

export interface ProcessStepTemplate {
  id: string;
  title: string;
  description?: string;
  estimate?: number;
  position: { x: number; y: number };
  is_start?: boolean;
}

export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
}
