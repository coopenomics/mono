import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { ComponentMetricService } from '../services/component-metric.service';
import { ComponentMetricOutputDTO } from '../dto/metrics/component-metric.dto';
import { CreateComponentMetricInputDTO } from '../dto/metrics/create-component-metric-input.dto';
import { UpdateComponentMetricInputDTO } from '../dto/metrics/update-component-metric-input.dto';
import { ArchiveComponentMetricInputDTO } from '../dto/metrics/archive-component-metric-input.dto';
import { GetComponentMetricsInputDTO } from '../dto/metrics/get-component-metrics-input.dto';
import { IssueMetricBindingOutputDTO } from '../dto/metrics/issue-metric-binding.dto';
import { SetIssueMetricBindingsInputDTO } from '../dto/metrics/set-issue-metric-bindings-input.dto';
import { GetIssueMetricBindingsInputDTO } from '../dto/metrics/get-issue-metric-bindings-input.dto';
import { MetricContributionOutputDTO } from '../dto/metrics/metric-contribution.dto';
import { LogMetricContributionInputDTO } from '../dto/metrics/log-metric-contribution-input.dto';
import { GetMetricContributionsInputDTO } from '../dto/metrics/get-metric-contributions-input.dto';

const paginatedMetricContributionsResult = createPaginationResult(
  MetricContributionOutputDTO,
  'PaginatedCapitalMetricContributions'
);

@Resolver()
export class ComponentMetricResolver {
  constructor(private readonly componentMetricService: ComponentMetricService) {}

  @Mutation(() => ComponentMetricOutputDTO, {
    name: 'capitalCreateComponentMetric',
    description: 'Создание нефинансовой метрики на компоненте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async createComponentMetric(
    @Args('data', { type: () => CreateComponentMetricInputDTO }) data: CreateComponentMetricInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<ComponentMetricOutputDTO> {
    return this.componentMetricService.createMetric(data, currentUser);
  }

  @Mutation(() => ComponentMetricOutputDTO, {
    name: 'capitalUpdateComponentMetric',
    description: 'Обновление метрики компонента',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async updateComponentMetric(
    @Args('data', { type: () => UpdateComponentMetricInputDTO }) data: UpdateComponentMetricInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<ComponentMetricOutputDTO> {
    return this.componentMetricService.updateMetric(data, currentUser);
  }

  @Mutation(() => ComponentMetricOutputDTO, {
    name: 'capitalArchiveComponentMetric',
    description: 'Архивация метрики компонента',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async archiveComponentMetric(
    @Args('data', { type: () => ArchiveComponentMetricInputDTO }) data: ArchiveComponentMetricInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<ComponentMetricOutputDTO> {
    return this.componentMetricService.archiveMetric(data.metric_hash, currentUser);
  }

  @Query(() => [ComponentMetricOutputDTO], {
    name: 'capitalComponentMetrics',
    description: 'Список метрик компонента с фактом',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getComponentMetrics(
    @Args('data') data: GetComponentMetricsInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<ComponentMetricOutputDTO[]> {
    return this.componentMetricService.getComponentMetrics(data.project_hash, data.status, currentUser);
  }

  @Mutation(() => [IssueMetricBindingOutputDTO], {
    name: 'capitalSetIssueMetricBindings',
    description: 'Установка привязок задачи к метрикам компонента',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async setIssueMetricBindings(
    @Args('data', { type: () => SetIssueMetricBindingsInputDTO }) data: SetIssueMetricBindingsInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<IssueMetricBindingOutputDTO[]> {
    return this.componentMetricService.setIssueMetricBindings(data, currentUser);
  }

  @Query(() => [IssueMetricBindingOutputDTO], {
    name: 'capitalIssueMetricBindings',
    description: 'Привязки задачи к метрикам',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getIssueMetricBindings(
    @Args('data') data: GetIssueMetricBindingsInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<IssueMetricBindingOutputDTO[]> {
    return this.componentMetricService.getIssueMetricBindings(data.issue_hash, currentUser);
  }

  @Mutation(() => MetricContributionOutputDTO, {
    name: 'capitalLogMetricContribution',
    description: 'Ручной вклад в метрику',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async logMetricContribution(
    @Args('data', { type: () => LogMetricContributionInputDTO }) data: LogMetricContributionInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<MetricContributionOutputDTO> {
    return this.componentMetricService.logMetricContribution(data, currentUser);
  }

  @Query(() => paginatedMetricContributionsResult, {
    name: 'capitalMetricContributions',
    description: 'Журнал вкладов в метрику',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getMetricContributions(
    @Args('data') data: GetMetricContributionsInputDTO,
    @Args('options', { nullable: true }) options: PaginationInputDTO | undefined,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<PaginationResult<MetricContributionOutputDTO>> {
    return this.componentMetricService.getMetricContributions(data.metric_hash, options, currentUser);
  }
}
