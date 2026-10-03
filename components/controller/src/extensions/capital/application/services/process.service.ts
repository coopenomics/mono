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
import { PROJECT_REPOSITORY } from '../../domain/repositories/project.repository';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import { IssueIdGenerationService } from '../../domain/services/issue-id-generation.service';
import type { IIssueDatabaseData } from '../../domain/interfaces/issue-database.interface';
import { t } from '../../i18n';
import { DomainError, generateUniqueHash } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { PermissionsService } from './permissions.service';
import { canViewLocalProject } from '../../domain/utils/private-project-access';

@Injectable()
export class ProcessService {
  private readonly logger = new Logger(ProcessService.name);

  constructor(
    @Inject(PROCESS_TEMPLATE_REPOSITORY) private readonly templateRepo: ProcessTemplateRepository,
    @Inject(PROCESS_INSTANCE_REPOSITORY) private readonly instanceRepo: ProcessInstanceRepository,
    @Inject(ISSUE_REPOSITORY) private readonly issueRepo: IssueRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepository,
    private readonly issueIdService: IssueIdGenerationService,
    private readonly permissionsService: PermissionsService,
  ) {}

  // ──── ДОСТУП К ПРОЕКТУ ────

  /**
   * Процессы живут внутри проекта и подчиняются его доступу. Вести процесс
   * (запускать, закрывать шаги) может тот, кто ведёт задачи проекта. Шаблоны
   * правит совет — по роли, как и прежде; личный проект при этом виден и
   * доступен только владельцу.
   */
  private async assertCanManage(projectHash: string, user: IMonoAccount): Promise<void> {
    const project = await this.projectRepo.findByHash(projectHash);
    if (!project) throw DomainError.notFound('CAPITAL_PROJECT_HASH_NOT_FOUND', { hash: projectHash });
    const permissions = await this.permissionsService.calculateProjectPermissions(project, user);
    if (!permissions.can_manage_issues) throw DomainError.forbidden('CAPITAL_PROCESS_PROJECT_FORBIDDEN');
  }

  private async canView(projectHash: string, user: IMonoAccount): Promise<boolean> {
    const project = await this.projectRepo.findByHash(projectHash);
    // Проекта нет — скрывать нечего: чтение отдаст пустой список.
    if (!project) return true;
    return canViewLocalProject(project, user.username);
  }

  private async assertCanView(projectHash: string, user: IMonoAccount): Promise<void> {
    if (!(await this.canView(projectHash, user))) throw DomainError.forbidden('CAPITAL_PROCESS_PROJECT_FORBIDDEN');
  }

  private async getTemplateOrFail(id: string): Promise<ProcessTemplateDomainEntity> {
    const template = await this.templateRepo.findById(id);
    if (!template) throw DomainError.notFound('CAPITAL_PROCESS_TEMPLATE_NOT_FOUND');
    return template;
  }

  // ──── ШАБЛОНЫ ────

  async createTemplate(data: {
    coopname: string;
    project_hash: string;
    title: string;
    description?: string;
    created_by: string;
  }, user: IMonoAccount): Promise<ProcessTemplateDomainEntity> {
    await this.assertCanView(data.project_hash, user);
    return this.templateRepo.create({
      ...data,
      status: ProcessTemplateStatus.DRAFT,
      steps: [],
      edges: [],
    });
  }

  async getTemplate(id: string, user: IMonoAccount): Promise<ProcessTemplateDomainEntity | null> {
    const template = await this.templateRepo.findById(id);
    if (!template) return null;
    await this.assertCanView(template.project_hash, user);
    return template;
  }

  async getTemplatesByProject(projectHash: string, user: IMonoAccount): Promise<ProcessTemplateDomainEntity[]> {
    await this.assertCanView(projectHash, user);
    return this.templateRepo.findByProjectHash(projectHash);
  }

  /** Шаблоны всего кооператива — без шаблонов чужих личных проектов. */
  async getTemplatesByCoopname(coopname: string, user: IMonoAccount): Promise<ProcessTemplateDomainEntity[]> {
    const templates = await this.templateRepo.findByCoopname(coopname);
    const visible = new Map<string, boolean>();
    const result: ProcessTemplateDomainEntity[] = [];
    for (const template of templates) {
      if (!visible.has(template.project_hash)) {
        visible.set(template.project_hash, await this.canView(template.project_hash, user));
      }
      if (visible.get(template.project_hash)) result.push(template);
    }
    return result;
  }

  async updateTemplate(
    id: string,
    data: Partial<ProcessTemplateDomainEntity>,
    user: IMonoAccount
  ): Promise<ProcessTemplateDomainEntity> {
    const template = await this.getTemplateOrFail(id);
    await this.assertCanView(template.project_hash, user);
    return this.templateRepo.update(id, data);
  }

  async deleteTemplate(id: string, user: IMonoAccount): Promise<void> {
    const template = await this.getTemplateOrFail(id);
    await this.assertCanView(template.project_hash, user);
    return this.templateRepo.delete(id);
  }

  // ──── ЭКЗЕМПЛЯРЫ (ИСПОЛНЕНИЕ) ────

  async startProcess(data: {
    template_id: string;
    project_hash: string;
    started_by: string;
    coopname: string;
  }, user: IMonoAccount): Promise<ProcessInstanceDomainEntity> {
    const template = await this.getTemplateOrFail(data.template_id);
    // Процесс идёт в проекте своего шаблона: чужой проект в запросе не подставить.
    if (template.project_hash.toLowerCase() !== data.project_hash.toLowerCase()) {
      throw DomainError.badRequest('CAPITAL_PROCESS_TEMPLATE_FOREIGN_PROJECT');
    }
    await this.assertCanManage(template.project_hash, user);
    if (template.status !== ProcessTemplateStatus.ACTIVE) {
      throw DomainError.conflict('CAPITAL_PROCESS_TEMPLATE_NOT_ACTIVE');
    }

    const startSteps = template.steps.filter(s => s.is_start);
    if (startSteps.length === 0) throw DomainError.conflict('CAPITAL_PROCESS_TEMPLATE_NO_START_STEPS');

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

  async completeStep(instanceId: string, stepId: string, user: IMonoAccount): Promise<ProcessInstanceDomainEntity> {
    const instance = await this.instanceRepo.findById(instanceId);
    if (!instance) throw DomainError.notFound('CAPITAL_PROCESS_INSTANCE_NOT_FOUND');
    await this.assertCanManage(instance.project_hash, user);

    const template = await this.getTemplateOrFail(instance.template_id);

    const stepState = instance.step_states.find(s => s.step_id === stepId);
    if (!stepState) throw DomainError.notFound('CAPITAL_PROCESS_STEP_NOT_FOUND');
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

  async getInstancesByProject(projectHash: string, user: IMonoAccount): Promise<ProcessInstanceDomainEntity[]> {
    await this.assertCanView(projectHash, user);
    return this.instanceRepo.findByProjectHash(projectHash);
  }

  async getInstance(id: string, user: IMonoAccount): Promise<ProcessInstanceDomainEntity | null> {
    const instance = await this.instanceRepo.findById(id);
    if (!instance) return null;
    await this.assertCanView(instance.project_hash, user);
    return instance;
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
      // Задача шага — обычная задача проекта: номер по счётчику проекта (ПРЕФИКС-число)
      // и хеш обычного вида, чтобы к ней привязывались коммиты и учёт времени.
      const project = await this.projectRepo.findByHash(instance.project_hash);
      if (!project) {
        throw DomainError.notFound('CAPITAL_PROJECT_HASH_NOT_FOUND', { hash: instance.project_hash });
      }

      const issueData: Omit<IIssueDatabaseData, 'id'> = {
        _id: '',
        issue_hash: generateUniqueHash(),
        coopname: instance.coopname,
        title: `[${template.title}] ${step.title}`,
        description: step.description || t('capital.process.taskTitle', { templateTitle: template.title, cycle: instance.cycle }),
        priority: IssuePriority.MEDIUM,
        status: IssueStatus.TODO,
        estimate: step.estimate || 0,
        sort_order: 0,
        created_by: createdBy,
        submaster: createdBy,
        creators: [createdBy],
        project_hash: instance.project_hash,
        cycle_id: undefined,
        metadata: { labels: ['process', template.title], attachments: [] },
        present: true,
      };
      const generated = this.issueIdService.generateIssueId(project, issueData);
      await this.projectRepo.update(generated.updatedProject);
      const issue = new IssueDomainEntity(generated.issueData);

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
