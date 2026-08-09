import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser, createPaginationResult, PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { MonoAccountDomainInterface } from '@coopenomics/innercoop';
import { ComponentMetricService } from '../services/component-metric.service';
import { ComponentMetricOutputDTO } from '../dto/metrics/component-metric.dto';
import { MeasureOutputDTO } from '../dto/metrics/measure.dto';
import { CreateComponentMetricInputDTO } from '../dto/metrics/create-component-metric-input.dto';
import { UpdateComponentMetricInputDTO } from '../dto/metrics/update-component-metric-input.dto';
import { CreateMeasureInputDTO } from '../dto/metrics/create-measure-input.dto';
import { UpdateMeasureInputDTO } from '../dto/metrics/update-measure-input.dto';
import { GetMeasuresInputDTO } from '../dto/metrics/get-measures-input.dto';
import { ArchiveComponentMetricInputDTO } from '../dto/metrics/archive-component-metric-input.dto';
import { GetComponentMetricsInputDTO } from '../dto/metrics/get-component-metrics-input.dto';
import { IssueMetricBindingOutputDTO } from '../dto/metrics/issue-metric-binding.dto';
import { SetIssueMetricBindingsInputDTO } from '../dto/metrics/set-issue-metric-bindings-input.dto';
import { GetIssueMetricBindingsInputDTO } from '../dto/metrics/get-issue-metric-bindings-input.dto';
import { MetricContributionOutputDTO } from '../dto/metrics/metric-contribution.dto';
import { LogMetricContributionInputDTO } from '../dto/metrics/log-metric-contribution-input.dto';
import { GetMetricContributionsInputDTO } from '../dto/metrics/get-metric-contributions-input.dto';
import { MetricSeriesOutputDTO } from '../dto/metrics/metric-series.dto';
import { GetMetricSeriesInputDTO } from '../dto/metrics/get-metric-series-input.dto';
import { MetricWaveOutputDTO } from '../dto/metrics/metric-wave.dto';
import { GetMetricWaveInputDTO } from '../dto/metrics/get-metric-wave-input.dto';
import { MetricSuperpositionOutputDTO, MetricSuperpositionHistoryOutputDTO } from '../dto/metrics/metric-superposition.dto';
import { GetMetricSuperpositionInputDTO } from '../dto/metrics/get-metric-superposition-input.dto';
import { GetMetricSuperpositionHistoryInputDTO } from '../dto/metrics/get-metric-superposition-history-input.dto';
// register GraphQL enums WaveLabel / WavePhase / MetricDriveDirection
import '../../domain/enums/wave-label.enum';
import '../../domain/enums/metric-drive-direction.enum';

const paginatedMetricContributionsResult = createPaginationResult(
  MetricContributionOutputDTO,
  'PaginatedCapitalMetricContributions'
);

@Resolver()
export class ComponentMetricResolver {
  constructor(private readonly componentMetricService: ComponentMetricService) {}

  @Mutation(() => MeasureOutputDTO, {
    name: 'capitalCreateMeasure',
    description:
      'Устарело: справочник мер централизован, создание только через миграции. Мутация всегда отклоняется.',
    deprecationReason: 'Справочник мер централизован — создание через миграции',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async createMeasure(
    @Args('data', { type: () => CreateMeasureInputDTO }) data: CreateMeasureInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<MeasureOutputDTO> {
    return this.componentMetricService.createMeasure(data, currentUser);
  }

  @Mutation(() => MeasureOutputDTO, {
    name: 'capitalUpdateMeasure',
    description: 'Включение или выключение меры в справочнике (без изменения состава)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async updateMeasure(
    @Args('data', { type: () => UpdateMeasureInputDTO }) data: UpdateMeasureInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<MeasureOutputDTO> {
    return this.componentMetricService.updateMeasure(data, currentUser);
  }

  @Query(() => [MeasureOutputDTO], {
    name: 'capitalMeasures',
    description: 'Справочник мер кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getMeasures(
    @Args('data') data: GetMeasuresInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<MeasureOutputDTO[]> {
    return this.componentMetricService.getMeasures(data.coopname, data.status, currentUser);
  }

  @Mutation(() => ComponentMetricOutputDTO, {
    name: 'capitalCreateComponentMetric',
    description: 'Создание цели по мере на компоненте',
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
    description: 'Обновление цели по мере на компоненте',
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
    description: 'Цели по мерам на компоненте с фактом',
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
    @Args('data', { type: () => GetMetricContributionsInputDTO }) data: GetMetricContributionsInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO,
    @CurrentUser() currentUser?: MonoAccountDomainInterface
  ): Promise<PaginationResult<MetricContributionOutputDTO>> {
    return this.componentMetricService.getMetricContributions(data.metric_hash, options, currentUser!);
  }

  @Query(() => MetricSeriesOutputDTO, {
    name: 'capitalMetricSeries',
    description: 'Временной ряд метрики: накопление и скорость по периодам',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getMetricSeries(
    @Args('data', { type: () => GetMetricSeriesInputDTO }) data: GetMetricSeriesInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<MetricSeriesOutputDTO> {
    return this.componentMetricService.getMetricSeries(data, currentUser);
  }

  @Query(() => MetricWaveOutputDTO, {
    name: 'capitalMetricWave',
    description: 'Волновая разметка метрики: 5/3, Фибо-сетка и прогнозный коридор',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getMetricWave(
    @Args('data', { type: () => GetMetricWaveInputDTO }) data: GetMetricWaveInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<MetricWaveOutputDTO> {
    return this.componentMetricService.getMetricWave(data, currentUser);
  }

  @Query(() => MetricSuperpositionOutputDTO, {
    name: 'capitalMetricSuperposition',
    description: 'Метрика резонанса и rollup планов/фактов по компонентам',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getMetricSuperposition(
    @Args('data', { type: () => GetMetricSuperpositionInputDTO }) data: GetMetricSuperpositionInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<MetricSuperpositionOutputDTO> {
    return this.componentMetricService.getMetricSuperposition(data, currentUser);
  }

  @Query(() => MetricSuperpositionHistoryOutputDTO, {
    name: 'capitalMetricSuperpositionHistory',
    description: 'История резонанса метрик по бакетам выбранного периода',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getMetricSuperpositionHistory(
    @Args('data', { type: () => GetMetricSuperpositionHistoryInputDTO })
    data: GetMetricSuperpositionHistoryInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<MetricSuperpositionHistoryOutputDTO> {
    return this.componentMetricService.getMetricSuperpositionHistory(data, currentUser);
  }
}
