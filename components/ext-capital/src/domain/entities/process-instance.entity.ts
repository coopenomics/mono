import { ProcessInstanceStatus, ProcessStepStatus } from '../enums/process-status.enum';

/**
 * Экземпляр процесса — конкретный запуск шаблона.
 * Создаёт задачи (issues) по мере продвижения.
 */
export class ProcessInstanceDomainEntity {
  public id!: string;
  public coopname!: string;
  public template_id!: string;
  public project_hash!: string;
  public status!: ProcessInstanceStatus;
  public started_by!: string;
  public started_at!: Date;
  public completed_at?: Date;
  public cycle!: number;

  /**
   * Состояние шагов текущего цикла.
   * Каждый шаг привязан к issue_hash (если задача создана).
   */
  public step_states!: ProcessStepState[];
}

export interface ProcessStepState {
  step_id: string;
  status: ProcessStepStatus;
  issue_hash?: string;
  completed_at?: Date;
}
