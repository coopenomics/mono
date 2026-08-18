import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser,
  platformSettings,
} from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { ProcessService } from '../services/process.service';
import { ProcessTemplateDTO, CreateProcessTemplateInputDTO, UpdateProcessTemplateInputDTO } from '../dto/process/process-template.dto';
import { ProcessInstanceDTO, StartProcessInputDTO, CompleteProcessStepInputDTO } from '../dto/process/process-instance.dto';

@Resolver()
export class ProcessResolver {
  constructor(private readonly processService: ProcessService) {}

  // ──── ШАБЛОНЫ (chairman/member) ────

  @Mutation(() => ProcessTemplateDTO, {
    name: 'capitalCreateProcessTemplate',
    description: 'Создание шаблона процесса',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async createProcessTemplate(
    @Args('data') data: CreateProcessTemplateInputDTO,
    @CurrentUser() user: IMonoAccount,
  ): Promise<ProcessTemplateDTO> {
    return this.processService.createTemplate({
      coopname: platformSettings().coopname,
      project_hash: data.project_hash,
      title: data.title,
      description: data.description,
      created_by: user.username,
    }) as any;
  }

  @Mutation(() => ProcessTemplateDTO, {
    name: 'capitalUpdateProcessTemplate',
    description: 'Обновление шаблона процесса (шаги, рёбра, статус)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async updateProcessTemplate(
    @Args('data') data: UpdateProcessTemplateInputDTO,
  ): Promise<ProcessTemplateDTO> {
    return this.processService.updateTemplate(data.id, data) as any;
  }

  @Mutation(() => Boolean, {
    name: 'capitalDeleteProcessTemplate',
    description: 'Удаление шаблона процесса',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async deleteProcessTemplate(
    @Args('id') id: string,
  ): Promise<boolean> {
    await this.processService.deleteTemplate(id);
    return true;
  }

  @Query(() => [ProcessTemplateDTO], {
    name: 'capitalGetProcessTemplates',
    description: 'Получение шаблонов процессов для проекта',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProcessTemplates(
    @Args('project_hash', { nullable: true }) projectHash?: string,
  ): Promise<ProcessTemplateDTO[]> {
    if (projectHash) {
      return this.processService.getTemplatesByProject(projectHash) as any;
    }
    return this.processService.getTemplatesByCoopname(platformSettings().coopname) as any;
  }

  @Query(() => ProcessTemplateDTO, {
    name: 'capitalGetProcessTemplate',
    description: 'Получение шаблона процесса по ID',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProcessTemplate(
    @Args('id') id: string,
  ): Promise<ProcessTemplateDTO | null> {
    return this.processService.getTemplate(id) as any;
  }

  // ──── ЭКЗЕМПЛЯРЫ (chairman/member/user) ────

  @Mutation(() => ProcessInstanceDTO, {
    name: 'capitalStartProcess',
    description: 'Запуск экземпляра процесса',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async startProcess(
    @Args('data') data: StartProcessInputDTO,
    @CurrentUser() user: IMonoAccount,
  ): Promise<ProcessInstanceDTO> {
    return this.processService.startProcess({
      template_id: data.template_id,
      project_hash: data.project_hash,
      started_by: user.username,
      coopname: platformSettings().coopname,
    }) as any;
  }

  @Mutation(() => ProcessInstanceDTO, {
    name: 'capitalCompleteProcessStep',
    description: 'Завершение шага процесса',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async completeProcessStep(
    @Args('data') data: CompleteProcessStepInputDTO,
  ): Promise<ProcessInstanceDTO> {
    return this.processService.completeStep(data.instance_id, data.step_id) as any;
  }

  @Query(() => [ProcessInstanceDTO], {
    name: 'capitalGetProcessInstances',
    description: 'Получение экземпляров процессов для проекта',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProcessInstances(
    @Args('project_hash') projectHash: string,
  ): Promise<ProcessInstanceDTO[]> {
    return this.processService.getInstancesByProject(projectHash) as any;
  }

  @Query(() => ProcessInstanceDTO, {
    name: 'capitalGetProcessInstance',
    description: 'Получение экземпляра процесса по ID',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProcessInstance(
    @Args('id') id: string,
  ): Promise<ProcessInstanceDTO | null> {
    return this.processService.getInstance(id) as any;
  }
}
