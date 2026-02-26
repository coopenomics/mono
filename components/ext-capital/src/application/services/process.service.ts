import { Injectable, Inject, Logger } from '@nestjs/common';
import { PROCESS_TEMPLATE_REPOSITORY, PROCESS_INSTANCE_REPOSITORY } from '../../domain/repositories/process.repository';
import type { ProcessTemplateRepository, ProcessInstanceRepository } from '../../domain/repositories/process.repository';
import type { ProcessTemplateDomainEntity } from '../../domain/entities/process-template.entity';
import type { ProcessInstanceDomainEntity, ProcessStepState } from '../../domain/entities/process-instance.entity';
import { ProcessTemplateStatus, ProcessInstanceStatus, ProcessStepStatus } from '../../domain/enums/process-status.enum';
import { ISSUE_REPOSITORY } from '../../domain/repositories/issue.repository';
import type { IssueRepository } from '../../domain/repositories/issue.repository';
import { IssueDomainEntity } from '../../domain/entities/issue.entity';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { config } from '~/config';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ProcessService {
  private readonly logger = new Logger(ProcessService.name);

  constructor(
    @Inject(PROCESS_TEMPLATE_REPOSITORY) private readonly templateRepo: ProcessTemplateRepository,
    @Inject(PROCESS_INSTANCE_REPOSITORY) private readonly instanceRepo: ProcessInstanceRepository,
    @Inject(ISSUE_REPOSITORY) private readonly issueRepo: IssueRepository,
  ) {}

  // ──── ШАБЛОНЫ ────

  async createTemplate(data: {
    coopname: string;
    project_hash: string;
    title: string;
    description?: string;
    created_by: string;
  }): Promise<ProcessTemplateDomainEntity> {
    return this.templateRepo.create({
      ...data,
      status: ProcessTemplateStatus.DRAFT,
      steps: [],
      edges: [],
    });
  }

  async getTemplate(id: string): Promise<ProcessTemplateDomainEntity | null> {
    return this.templateRepo.findById(id);
  }

  async getTemplatesByProject(projectHash: string): Promise<ProcessTemplateDomainEntity[]> {
    return this.templateRepo.findByProjectHash(projectHash);
  }

  async getTemplatesByCoopname(coopname: string): Promise<ProcessTemplateDomainEntity[]> {
    return this.templateRepo.findByCoopname(coopname);
  }

  async updateTemplate(id: string, data: Partial<ProcessTemplateDomainEntity>): Promise<ProcessTemplateDomainEntity> {
    return this.templateRepo.update(id, data);
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.templateRepo.delete(id);
  }

  // ──── ЭКЗЕМПЛЯРЫ (ИСПОЛНЕНИЕ) ────

  async startProcess(data: {
    template_id: string;
    project_hash: string;
    started_by: string;
    coopname: string;
  }): Promise<ProcessInstanceDomainEntity> {
    const template = await this.templateRepo.findById(data.template_id);
    if (!template) throw new Error('Шаблон процесса не найден');
    if (template.status !== ProcessTemplateStatus.ACTIVE) {
      throw new Error('Шаблон процесса должен быть в статусе ACTIVE');
    }

    const startSteps = template.steps.filter(s => s.is_start);
    if (startSteps.length === 0) throw new Error('В шаблоне нет стартовых шагов');

    const stepStates: ProcessStepState[] = template.steps.map(step => ({
      step_id: step.id,
      status: step.is_start ? ProcessStepStatus.ACTIVE : ProcessStepStatus.PENDING,
    }));

    const instance = await this.instanceRepo.create({
      coopname: data.coopname,
      template_id: data.template_id,
      project_hash: data.project_hash,
      status: ProcessInstanceStatus.RUNNING,
      started_by: data.started_by,
      cycle: 1,
      step_states: stepStates,
    });

    for (const step of startSteps) {
      await this.createIssueForStep(instance, template, step.id, data.started_by);
    }

    return instance;
  }

  async completeStep(instanceId: string, stepId: string): Promise<ProcessInstanceDomainEntity> {
    const instance = await this.instanceRepo.findById(instanceId);
    if (!instance) throw new Error('Экземпляр процесса не найден');

    const template = await this.templateRepo.findById(instance.template_id);
    if (!template) throw new Error('Шаблон процесса не найден');

    const stepState = instance.step_states.find(s => s.step_id === stepId);
    if (!stepState) throw new Error('Шаг не найден');
    if (stepState.status === ProcessStepStatus.COMPLETED) return instance;

    stepState.status = ProcessStepStatus.COMPLETED;
    stepState.completed_at = new Date();

    const nextStepIds = template.edges
      .filter(e => e.source === stepId)
      .map(e => e.target);

    for (const nextId of nextStepIds) {
      const incomingEdges = template.edges.filter(e => e.target === nextId);
      const allSourcesCompleted = incomingEdges.every(e => {
        const srcState = instance.step_states.find(s => s.step_id === e.source);
        return srcState?.status === ProcessStepStatus.COMPLETED;
      });

      if (allSourcesCompleted) {
        const nextState = instance.step_states.find(s => s.step_id === nextId);
        if (nextState && nextState.status === ProcessStepStatus.PENDING) {
          nextState.status = ProcessStepStatus.ACTIVE;
          await this.createIssueForStep(instance, template, nextId, instance.started_by);
        }
      }
    }

    const terminalStepIds = template.steps
      .filter(s => !template.edges.some(e => e.source === s.id))
      .map(s => s.id);

    const allTerminalDone = terminalStepIds.every(id => {
      const state = instance.step_states.find(s => s.step_id === id);
      return state?.status === ProcessStepStatus.COMPLETED || state?.status === ProcessStepStatus.CANCELLED;
    });

    if (allTerminalDone) {
      instance.status = ProcessInstanceStatus.COMPLETED;
      instance.completed_at = new Date();
    }

    return this.instanceRepo.update(instance.id, {
      step_states: instance.step_states,
      status: instance.status,
      completed_at: instance.completed_at,
    });
  }

  async getInstancesByProject(projectHash: string): Promise<ProcessInstanceDomainEntity[]> {
    return this.instanceRepo.findByProjectHash(projectHash);
  }

  async getInstance(id: string): Promise<ProcessInstanceDomainEntity | null> {
    return this.instanceRepo.findById(id);
  }

  // ──── СОЗДАНИЕ ЗАДАЧ ────

  private async createIssueForStep(
    instance: ProcessInstanceDomainEntity,
    template: ProcessTemplateDomainEntity,
    stepId: string,
    createdBy: string,
  ): Promise<void> {
    const step = template.steps.find(s => s.id === stepId);
    if (!step) return;

    try {
      const issueHash = uuid().replace(/-/g, '').toUpperCase();
      const prefix = instance.project_hash.substring(0, 3).toUpperCase();
      const issueId = `${prefix}-P${Date.now().toString(36).toUpperCase()}`;

      const issue = new IssueDomainEntity({
        _id: '' as any,
        _created_at: new Date(),
        _updated_at: new Date(),
        present: true,
        id: issueId,
        issue_hash: issueHash,
        coopname: instance.coopname,
        title: `[${template.title}] ${step.title}`,
        description: step.description || `Задача процесса "${template.title}", цикл ${instance.cycle}`,
        priority: IssuePriority.MEDIUM,
        status: IssueStatus.TODO,
        estimate: step.estimate || 0,
        sort_order: 0,
        created_by: createdBy,
        creators: [createdBy],
        project_hash: instance.project_hash,
        metadata: { labels: ['process', template.title], attachments: [] },
      } as any);

      const savedIssue = await this.issueRepo.create(issue);

      const stepState = instance.step_states.find(s => s.step_id === stepId);
      if (stepState) {
        stepState.issue_hash = savedIssue.issue_hash;
      }

      await this.instanceRepo.update(instance.id, { step_states: instance.step_states });

      this.logger.log(`Задача "${step.title}" создана для процесса "${template.title}"`);
    } catch (error: any) {
      this.logger.warn(`Не удалось создать задачу для шага ${stepId}: ${error?.message}`);
    }
  }
}
