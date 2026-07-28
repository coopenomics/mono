import { Injectable, Inject } from '@nestjs/common';
import {
  COMPONENT_METRIC_REPOSITORY,
  type ComponentMetricRepository,
} from '../../domain/repositories/component-metric.repository';
import {
  ISSUE_METRIC_BINDING_REPOSITORY,
  type IssueMetricBindingRepository,
} from '../../domain/repositories/issue-metric-binding.repository';
import {
  METRIC_CONTRIBUTION_REPOSITORY,
  type MetricContributionRepository,
} from '../../domain/repositories/metric-contribution.repository';
import { PROJECT_REPOSITORY } from '../../domain/repositories/project.repository';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import { ISSUE_REPOSITORY } from '../../domain/repositories/issue.repository';
import type { IssueRepository } from '../../domain/repositories/issue.repository';
import { ComponentMetricDomainEntity } from '../../domain/entities/component-metric.entity';
import { IssueMetricBindingDomainEntity } from '../../domain/entities/issue-metric-binding.entity';
import { MetricContributionDomainEntity } from '../../domain/entities/metric-contribution.entity';
import { MetricSeriesMode } from '../../domain/enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../../domain/enums/metric-series-period.enum';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { MetricContributionSource } from '../../domain/enums/metric-contribution-source.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { buildMetricSeries } from '../../domain/utils/build-metric-series';
import { PermissionsService } from './permissions.service';
import { generateUniqueHash } from '~/utils/generate-hash.util';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import type { CreateComponentMetricInputDTO } from '../dto/metrics/create-component-metric-input.dto';
import type { UpdateComponentMetricInputDTO } from '../dto/metrics/update-component-metric-input.dto';
import type { SetIssueMetricBindingsInputDTO } from '../dto/metrics/set-issue-metric-bindings-input.dto';
import type { LogMetricContributionInputDTO } from '../dto/metrics/log-metric-contribution-input.dto';
import type { GetMetricSeriesInputDTO } from '../dto/metrics/get-metric-series-input.dto';
import type { GetMetricWaveInputDTO } from '../dto/metrics/get-metric-wave-input.dto';
import type { GetMetricSuperpositionInputDTO } from '../dto/metrics/get-metric-superposition-input.dto';
import type { GetMetricSuperpositionHistoryInputDTO } from '../dto/metrics/get-metric-superposition-history-input.dto';
import type { ComponentMetricOutputDTO } from '../dto/metrics/component-metric.dto';
import type { IssueMetricBindingOutputDTO } from '../dto/metrics/issue-metric-binding.dto';
import type { MetricContributionOutputDTO } from '../dto/metrics/metric-contribution.dto';
import type { MetricSeriesOutputDTO } from '../dto/metrics/metric-series.dto';
import type { MetricWaveOutputDTO } from '../dto/metrics/metric-wave.dto';
import type {
  MetricSuperpositionHistoryOutputDTO,
  MetricSuperpositionOutputDTO,
} from '../dto/metrics/metric-superposition.dto';
import {
  analyzeWave,
  WaveLabel,
  WAVE_DISCLAIMER,
} from '../../domain/utils/wave-markup';
import {
  computeSuperpositionAt,
  defaultSuperpositionFrom,
  listSuperpositionFrameAts,
  type SuperpositionContributionInput,
  type SuperpositionMetricInput,
} from '../../domain/utils/compute-metric-superposition';
import type { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';

/**
 * Сервис нефинансовых метрик компонента (волновой планер).
 * Off-chain: метрика → привязки задач → журнал вкладов → ряд burn-up/скорости.
 */
@Injectable()
export class ComponentMetricService {
  constructor(
    @Inject(COMPONENT_METRIC_REPOSITORY)
    private readonly metricRepository: ComponentMetricRepository,
    @Inject(ISSUE_METRIC_BINDING_REPOSITORY)
    private readonly bindingRepository: IssueMetricBindingRepository,
    @Inject(METRIC_CONTRIBUTION_REPOSITORY)
    private readonly contributionRepository: MetricContributionRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    private readonly permissionsService: PermissionsService
  ) {}

  async createMetric(
    data: CreateComponentMetricInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<ComponentMetricOutputDTO> {
    const project = await this.projectRepository.findByHash(data.project_hash);
    if (!project) {
      throw new Error(`Компонент с хэшем ${data.project_hash} не найден`);
    }
    await this.assertCanManageMetrics(project, currentUser);

    const metric = new ComponentMetricDomainEntity({
      _id: '',
      metric_hash: generateUniqueHash(),
      coopname: data.coopname,
      project_hash: data.project_hash,
      title: data.title,
      unit: data.unit,
      target_value: data.target_value,
      deadline: data.deadline ?? null,
      series_mode: data.series_mode ?? MetricSeriesMode.RATE,
      created_by: currentUser.username,
      status: MetricStatus.ACTIVE,
      present: false,
      block_num: 0,
    });

    const created = await this.metricRepository.create(metric);
    return this.toMetricOutput(created, 0);
  }

  async updateMetric(
    data: UpdateComponentMetricInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<ComponentMetricOutputDTO> {
    const existing = await this.metricRepository.findByMetricHash(data.metric_hash);
    if (!existing) {
      throw new Error(`Метрика ${data.metric_hash} не найдена`);
    }
    if (existing.status === MetricStatus.ARCHIVED) {
      throw new Error('Нельзя изменять архивную метрику');
    }
    const project = await this.projectRepository.findByHash(existing.project_hash);
    if (!project) {
      throw new Error(`Компонент ${existing.project_hash} не найден`);
    }
    await this.assertCanManageMetrics(project, currentUser);

    const updated = new ComponentMetricDomainEntity({
      _id: existing._id,
      metric_hash: existing.metric_hash,
      coopname: existing.coopname,
      project_hash: existing.project_hash,
      title: data.title ?? existing.title,
      unit: data.unit ?? existing.unit,
      target_value: data.target_value ?? existing.target_value,
      deadline: data.deadline !== undefined ? data.deadline : existing.deadline,
      series_mode: data.series_mode ?? existing.series_mode,
      created_by: existing.created_by,
      status: existing.status,
      present: existing.present,
      block_num: existing.block_num,
      _created_at: existing._created_at,
      _updated_at: existing._updated_at,
    });

    const saved = await this.metricRepository.update(updated);
    const fact = await this.contributionRepository.sumDeltaByMetricHash(saved.metric_hash);
    return this.toMetricOutput(saved, fact);
  }

  async archiveMetric(
    metricHash: string,
    currentUser: MonoAccountDomainInterface
  ): Promise<ComponentMetricOutputDTO> {
    const existing = await this.metricRepository.findByMetricHash(metricHash);
    if (!existing) {
      throw new Error(`Метрика ${metricHash} не найдена`);
    }
    const project = await this.projectRepository.findByHash(existing.project_hash);
    if (!project) {
      throw new Error(`Компонент ${existing.project_hash} не найден`);
    }
    await this.assertCanManageMetrics(project, currentUser);

    existing.archive();
    const saved = await this.metricRepository.update(existing);
    const fact = await this.contributionRepository.sumDeltaByMetricHash(saved.metric_hash);
    return this.toMetricOutput(saved, fact);
  }

  async getComponentMetrics(
    projectHash: string,
    status: MetricStatus | undefined,
    currentUser: MonoAccountDomainInterface
  ): Promise<ComponentMetricOutputDTO[]> {
    const project = await this.projectRepository.findByHash(projectHash);
    if (!project) {
      throw new Error(`Компонент с хэшем ${projectHash} не найден`);
    }
    const permissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
    if (!permissions.can_view_artifacts && !permissions.has_clearance && !permissions.has_parent_clearance) {
      throw new Error('Нет прав на просмотр метрик компонента');
    }

    const metrics = await this.metricRepository.findByProjectHash(
      projectHash,
      status ?? MetricStatus.ACTIVE
    );
    const facts = await this.contributionRepository.sumDeltaByMetricHashes(
      metrics.map((m) => m.metric_hash)
    );
    return metrics.map((m) => this.toMetricOutput(m, facts.get(m.metric_hash) ?? 0));
  }

  async setIssueMetricBindings(
    data: SetIssueMetricBindingsInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<IssueMetricBindingOutputDTO[]> {
    const issue = await this.issueRepository.findByIssueHash(data.issue_hash);
    if (!issue) {
      throw new Error(`Задача ${data.issue_hash} не найдена`);
    }
    const project = await this.projectRepository.findByHash(issue.project_hash);
    if (!project) {
      throw new Error(`Компонент ${issue.project_hash} не найден`);
    }
    await this.assertCanEditIssueMetrics(project, issue, currentUser);

    if (issue.status === IssueStatus.DONE) {
      throw new Error(
        'Нельзя изменять привязки метрик у выполненной задачи: вклад зафиксирован при переводе в статус «Выполнена»'
      );
    }

    for (const item of data.bindings) {
      const metric = await this.metricRepository.findByMetricHash(item.metric_hash);
      if (!metric) {
        throw new Error(`Метрика ${item.metric_hash} не найдена`);
      }
      if (metric.project_hash !== issue.project_hash.toLowerCase()) {
        throw new Error(`Метрика ${item.metric_hash} не принадлежит компоненту задачи`);
      }
      if (metric.status === MetricStatus.ARCHIVED) {
        throw new Error(`Метрика ${item.metric_hash} в архиве`);
      }
    }

    const entities = data.bindings.map(
      (item) =>
        new IssueMetricBindingDomainEntity({
          _id: '',
          issue_hash: data.issue_hash,
          metric_hash: item.metric_hash,
          delta: item.delta,
          present: false,
          block_num: 0,
          status: 'active',
        })
    );

    const saved = await this.bindingRepository.replaceForIssue(data.issue_hash, entities);
    return saved.map((b) => this.toBindingOutput(b));
  }

  async getIssueMetricBindings(
    issueHash: string,
    currentUser: MonoAccountDomainInterface
  ): Promise<IssueMetricBindingOutputDTO[]> {
    const issue = await this.issueRepository.findByIssueHash(issueHash);
    if (!issue) {
      throw new Error(`Задача ${issueHash} не найдена`);
    }
    const project = await this.projectRepository.findByHash(issue.project_hash);
    if (!project) {
      throw new Error(`Компонент ${issue.project_hash} не найден`);
    }
    const permissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
    if (!permissions.can_view_artifacts && !permissions.has_clearance && !permissions.has_parent_clearance) {
      throw new Error('Нет прав на просмотр привязок метрик');
    }
    const bindings = await this.bindingRepository.findByIssueHash(issueHash);
    return bindings.map((b) => this.toBindingOutput(b));
  }

  async logMetricContribution(
    data: LogMetricContributionInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<MetricContributionOutputDTO> {
    const metric = await this.metricRepository.findByMetricHash(data.metric_hash);
    if (!metric) {
      throw new Error(`Метрика ${data.metric_hash} не найдена`);
    }
    if (metric.status === MetricStatus.ARCHIVED) {
      throw new Error('Нельзя писать вклад в архивную метрику');
    }
    const project = await this.projectRepository.findByHash(metric.project_hash);
    if (!project) {
      throw new Error(`Компонент ${metric.project_hash} не найден`);
    }
    await this.assertCanManageMetrics(project, currentUser);

    if (data.issue_hash) {
      const issue = await this.issueRepository.findByIssueHash(data.issue_hash);
      if (!issue || issue.project_hash.toLowerCase() !== metric.project_hash) {
        throw new Error('Задача не принадлежит компоненту метрики');
      }
    }

    const contribution = new MetricContributionDomainEntity({
      _id: '',
      contribution_hash: generateUniqueHash(),
      metric_hash: data.metric_hash,
      issue_hash: data.issue_hash ?? null,
      delta: data.delta,
      source: MetricContributionSource.MANUAL,
      username: currentUser.username,
      occurred_at: new Date(),
      present: false,
      block_num: 0,
      status: 'active',
    });

    const saved = await this.contributionRepository.create(contribution);
    return this.toContributionOutput(saved);
  }

  async getMetricContributions(
    metricHash: string,
    options: PaginationInputDTO | undefined,
    currentUser: MonoAccountDomainInterface
  ): Promise<PaginationResult<MetricContributionOutputDTO>> {
    const metric = await this.metricRepository.findByMetricHash(metricHash);
    if (!metric) {
      throw new Error(`Метрика ${metricHash} не найдена`);
    }
    const project = await this.projectRepository.findByHash(metric.project_hash);
    if (!project) {
      throw new Error(`Компонент ${metric.project_hash} не найден`);
    }
    const permissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
    if (!permissions.can_view_artifacts && !permissions.has_clearance && !permissions.has_parent_clearance) {
      throw new Error('Нет прав на просмотр журнала вкладов');
    }

    const result = await this.contributionRepository.findByMetricHashPaginated(metricHash, options);
    return {
      items: result.items.map((c) => this.toContributionOutput(c)),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Временной ряд метрики: накопление (burn-up) и Δ за период (скорость).
   */
  async getMetricSeries(
    data: GetMetricSeriesInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<MetricSeriesOutputDTO> {
    const metric = await this.metricRepository.findByMetricHash(data.metric_hash);
    if (!metric) {
      throw new Error(`Метрика ${data.metric_hash} не найдена`);
    }
    const project = await this.projectRepository.findByHash(metric.project_hash);
    if (!project) {
      throw new Error(`Компонент ${metric.project_hash} не найден`);
    }
    const permissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
    if (!permissions.can_view_artifacts && !permissions.has_clearance && !permissions.has_parent_clearance) {
      throw new Error('Нет прав на просмотр ряда метрики');
    }

    const period = data.period ?? MetricSeriesPeriod.WEEK;
    const to = data.to ? new Date(data.to) : new Date();
    const from = data.from ? new Date(data.from) : this.defaultSeriesFrom(to, period);

    const contributions = await this.contributionRepository.findChronologicalByMetricHash(
      data.metric_hash
    );
    const fact = contributions.reduce((sum, c) => sum + c.delta, 0);
    const planStart = metric._created_at ? new Date(metric._created_at) : from;

    const points = buildMetricSeries(
      contributions.map((c) => ({ delta: c.delta, occurred_at: c.occurred_at })),
      {
        period,
        from,
        to,
        target_value: metric.target_value,
        plan_start: planStart,
        deadline: metric.deadline ? new Date(metric.deadline) : null,
      }
    );

    return {
      metric_hash: metric.metric_hash,
      title: metric.title,
      unit: metric.unit,
      target_value: metric.target_value,
      series_mode: metric.series_mode,
      period,
      fact,
      points,
    };
  }

  /**
   * Волна 5/3 + Фибо + прогнозный коридор поверх ряда метрики (без SoT в БД).
   */
  async getMetricWave(
    data: GetMetricWaveInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<MetricWaveOutputDTO> {
    const series = await this.getMetricSeries(
      {
        metric_hash: data.metric_hash,
        period: data.period,
      },
      currentUser
    );

    const values =
      series.series_mode === MetricSeriesMode.LEVEL
        ? series.points.map((p) => p.cumulative)
        : series.points.map((p) => p.delta);

    const markup = analyzeWave({
      values,
      series_mode: series.series_mode,
      fact: series.fact,
      target_value: series.target_value,
      periods_ahead: data.periods_ahead ?? 8,
    });

    return {
      metric_hash: series.metric_hash,
      title: series.title,
      unit: series.unit,
      target_value: series.target_value,
      fact: series.fact,
      series_mode: series.series_mode,
      period: series.period,
      values,
      current_label: markup.current_label,
      current_phase: markup.current_phase,
      swings: markup.swings,
      point_labels: markup.point_labels.map((l) => l ?? WaveLabel.W1),
      fib_levels: markup.fib_levels,
      corridor: markup.corridor,
      disclaimer: markup.disclaimer,
    };
  }

  /**
   * Суперпозиция метрик + rollup по дочерним компонентам.
   */
  async getMetricSuperposition(
    data: GetMetricSuperpositionInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<MetricSuperpositionOutputDTO> {
    const ctx = await this.loadSuperpositionContext(data.project_hash, data.period, currentUser);
    const to = new Date();
    const from = defaultSuperpositionFrom(to, ctx.period);
    const snapshot = computeSuperpositionAt(
      ctx.metricsInput,
      ctx.contributionsByMetric,
      ctx.period,
      from,
      to
    );

    const components = ctx.scopes.map((scope) => {
      const scopeItems = snapshot.items.filter(
        (i) => i.project_hash.toLowerCase() === scope.project_hash.toLowerCase()
      );
      return {
        project_hash: scope.project_hash,
        project_title: scope.title ?? scope.project_hash,
        metrics_count: scopeItems.length,
        fact_sum: scopeItems.reduce((s, i) => s + i.fact, 0),
        target_sum: scopeItems.reduce((s, i) => s + i.target_value, 0),
      };
    });

    return {
      project_hash: ctx.project.project_hash,
      period: ctx.period,
      fact_sum: snapshot.fact_sum,
      target_sum: snapshot.target_sum,
      up_count: snapshot.up_count,
      down_count: snapshot.down_count,
      flat_count: snapshot.flat_count,
      activity: snapshot.activity,
      coherence: snapshot.coherence,
      balance: snapshot.balance,
      growth: snapshot.growth,
      resultant_re: snapshot.resultant_re,
      resultant_im: snapshot.resultant_im,
      resultant_magnitude: snapshot.resultant_magnitude,
      resultant_angle: snapshot.resultant_angle,
      items: snapshot.items,
      components,
      disclaimer: WAVE_DISCLAIMER,
    };
  }

  /**
   * История суперпозиции: кадр на каждый бакет периода в окне lookback.
   */
  async getMetricSuperpositionHistory(
    data: GetMetricSuperpositionHistoryInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<MetricSuperpositionHistoryOutputDTO> {
    const ctx = await this.loadSuperpositionContext(data.project_hash, data.period, currentUser);
    const to = new Date();
    const from = defaultSuperpositionFrom(to, ctx.period);
    const frameAts = listSuperpositionFrameAts(from, to, ctx.period);

    const frames = frameAts.map((at) => {
      const frameFrom = defaultSuperpositionFrom(at, ctx.period);
      const snapshot = computeSuperpositionAt(
        ctx.metricsInput,
        ctx.contributionsByMetric,
        ctx.period,
        frameFrom,
        at
      );
      return {
        at,
        activity: snapshot.activity,
        coherence: snapshot.coherence,
        balance: snapshot.balance,
        growth: snapshot.growth,
        resultant_re: snapshot.resultant_re,
        resultant_im: snapshot.resultant_im,
        resultant_magnitude: snapshot.resultant_magnitude,
        resultant_angle: snapshot.resultant_angle,
        fact_sum: snapshot.fact_sum,
        target_sum: snapshot.target_sum,
        up_count: snapshot.up_count,
        down_count: snapshot.down_count,
        flat_count: snapshot.flat_count,
        items: snapshot.items,
      };
    });

    return {
      project_hash: ctx.project.project_hash,
      period: ctx.period,
      from,
      to,
      frames,
    };
  }

  private async loadSuperpositionContext(
    projectHash: string,
    periodInput: MetricSeriesPeriod | undefined,
    currentUser: MonoAccountDomainInterface
  ) {
    const project = await this.projectRepository.findByHash(projectHash);
    if (!project) {
      throw new Error(`Проект ${projectHash} не найден`);
    }
    const permissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
    if (!permissions.can_view_artifacts && !permissions.has_clearance && !permissions.has_parent_clearance) {
      throw new Error('Нет прав на просмотр суперпозиции метрик');
    }

    const period = periodInput ?? MetricSeriesPeriod.WEEK;
    const children = await this.projectRepository.findComponentsByParentHash(projectHash);
    const scopes = children.length > 0 ? children : [project];
    const scopeHashes = scopes.map((s) => s.project_hash);
    const titleByHash = new Map(
      scopes.map((s) => [s.project_hash.toLowerCase(), s.title ?? s.project_hash] as const)
    );

    const metrics = await this.metricRepository.findByProjectHashes(scopeHashes, MetricStatus.ACTIVE);
    const contributionsByMetric = new Map<string, SuperpositionContributionInput[]>();
    for (const metric of metrics) {
      const contributions = await this.contributionRepository.findChronologicalByMetricHash(
        metric.metric_hash
      );
      contributionsByMetric.set(
        metric.metric_hash.toLowerCase(),
        contributions.map((c) => ({ delta: c.delta, occurred_at: c.occurred_at }))
      );
    }

    const metricsInput: SuperpositionMetricInput[] = metrics.map((metric) => ({
      metric_hash: metric.metric_hash,
      project_hash: metric.project_hash,
      project_title: titleByHash.get(metric.project_hash.toLowerCase()) ?? metric.project_hash,
      title: metric.title,
      unit: metric.unit,
      target_value: metric.target_value,
      series_mode: metric.series_mode,
      plan_start: metric._created_at ? new Date(metric._created_at) : null,
      deadline: metric.deadline ? new Date(metric.deadline) : null,
    }));

    return { project, period, scopes, metricsInput, contributionsByMetric };
  }

  private defaultSeriesFrom(to: Date, period: MetricSeriesPeriod): Date {
    return defaultSuperpositionFrom(to, period);
  }

  /**
   * Хук перехода статуса задачи: DONE → журнал из bindings; уход из DONE → compensating reverse.
   */
  async handleIssueStatusTransition(
    issueHash: string,
    previousStatus: IssueStatus,
    nextStatus: IssueStatus,
    username: string
  ): Promise<void> {
    const becameDone = nextStatus === IssueStatus.DONE && previousStatus !== IssueStatus.DONE;
    const leftDone = previousStatus === IssueStatus.DONE && nextStatus !== IssueStatus.DONE;

    if (!becameDone && !leftDone) {
      return;
    }

    const bindings = await this.bindingRepository.findByIssueHash(issueHash);
    if (bindings.length === 0) {
      return;
    }

    const now = new Date();
    const contributions: MetricContributionDomainEntity[] = [];

    for (const binding of bindings) {
      if (becameDone) {
        contributions.push(
          new MetricContributionDomainEntity({
            _id: '',
            contribution_hash: generateUniqueHash(),
            metric_hash: binding.metric_hash,
            issue_hash: issueHash,
            delta: binding.delta,
            source: MetricContributionSource.ISSUE_DONE,
            username,
            occurred_at: now,
            present: false,
            block_num: 0,
            status: 'active',
          })
        );
      } else if (leftDone) {
        // Compensating reverse: откатываем чистый вклад DONE−REOPEN по этой паре
        const net = await this.contributionRepository.sumIssueDoneDeltaByIssueAndMetric(
          issueHash,
          binding.metric_hash
        );
        if (net === 0) {
          continue;
        }
        contributions.push(
          new MetricContributionDomainEntity({
            _id: '',
            contribution_hash: generateUniqueHash(),
            metric_hash: binding.metric_hash,
            issue_hash: issueHash,
            delta: -net,
            source: MetricContributionSource.ISSUE_REOPEN,
            username,
            occurred_at: now,
            present: false,
            block_num: 0,
            status: 'active',
          })
        );
      }
    }

    await this.contributionRepository.createMany(contributions);
  }

  private async assertCanManageMetrics(
    project: Awaited<ReturnType<ProjectRepository['findByHash']>>,
    currentUser: MonoAccountDomainInterface
  ): Promise<void> {
    if (!project) {
      throw new Error('Компонент не найден');
    }
    const permissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
    if (!permissions.can_manage_issues && !permissions.can_edit_project) {
      throw new Error('Нет прав на управление метриками компонента');
    }
  }

  private async assertCanEditIssueMetrics(
    project: NonNullable<Awaited<ReturnType<ProjectRepository['findByHash']>>>,
    issue: NonNullable<Awaited<ReturnType<IssueRepository['findByIssueHash']>>>,
    currentUser: MonoAccountDomainInterface
  ): Promise<void> {
    const projectPermissions = await this.permissionsService.calculateProjectPermissions(
      project,
      currentUser
    );
    const issuePermissions = await this.permissionsService.calculateIssuePermissions(issue, currentUser);
    if (!projectPermissions.can_manage_issues && !issuePermissions.can_edit_issue) {
      throw new Error('Нет прав на привязку метрик к задаче');
    }
  }

  private toMetricOutput(metric: ComponentMetricDomainEntity, fact: number): ComponentMetricOutputDTO {
    return {
      _id: metric._id,
      present: metric.present,
      block_num: metric.block_num,
      _created_at: metric._created_at,
      _updated_at: metric._updated_at,
      metric_hash: metric.metric_hash,
      coopname: metric.coopname,
      project_hash: metric.project_hash,
      title: metric.title,
      unit: metric.unit,
      target_value: metric.target_value,
      deadline: metric.deadline,
      series_mode: metric.series_mode,
      created_by: metric.created_by,
      status: metric.status,
      fact,
    };
  }

  private toBindingOutput(binding: IssueMetricBindingDomainEntity): IssueMetricBindingOutputDTO {
    return {
      _id: binding._id,
      present: binding.present,
      block_num: binding.block_num,
      _created_at: binding._created_at,
      _updated_at: binding._updated_at,
      issue_hash: binding.issue_hash,
      metric_hash: binding.metric_hash,
      delta: binding.delta,
    };
  }

  private toContributionOutput(
    contribution: MetricContributionDomainEntity
  ): MetricContributionOutputDTO {
    return {
      _id: contribution._id,
      present: contribution.present,
      block_num: contribution.block_num,
      _created_at: contribution._created_at,
      _updated_at: contribution._updated_at,
      contribution_hash: contribution.contribution_hash,
      metric_hash: contribution.metric_hash,
      issue_hash: contribution.issue_hash,
      delta: contribution.delta,
      source: contribution.source,
      username: contribution.username,
      occurred_at: contribution.occurred_at,
    };
  }
}
