import { ComponentMetricService } from './component-metric.service';
import type { ComponentMetricRepository } from '../../domain/repositories/component-metric.repository';
import type { MeasureRepository } from '../../domain/repositories/measure.repository';
import type { IssueMetricBindingRepository } from '../../domain/repositories/issue-metric-binding.repository';
import type { MetricContributionRepository } from '../../domain/repositories/metric-contribution.repository';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { IssueRepository } from '../../domain/repositories/issue.repository';
import { IssueMetricBindingDomainEntity } from '../../domain/entities/issue-metric-binding.entity';
import { MetricContributionDomainEntity } from '../../domain/entities/metric-contribution.entity';
import { MetricContributionSource } from '../../domain/enums/metric-contribution-source.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import type { PermissionsService } from './permissions.service';

type MockedMethods<T> = { [K in keyof T]?: jest.Mock };

describe('ComponentMetricService.handleIssueStatusTransition (562-34)', () => {
  let service: ComponentMetricService;
  let bindingRepository: MockedMethods<IssueMetricBindingRepository>;
  let contributionRepository: MockedMethods<MetricContributionRepository>;
  let created: MetricContributionDomainEntity[];

  function makeBinding(metricHash: string, delta: number): IssueMetricBindingDomainEntity {
    return new IssueMetricBindingDomainEntity({
      _id: '',
      issue_hash: 'issue-1',
      metric_hash: metricHash,
      delta,
      present: false,
      block_num: 0,
      status: 'active',
    });
  }

  beforeEach(() => {
    created = [];
    bindingRepository = {
      findByIssueHash: jest.fn(),
    };
    contributionRepository = {
      createMany: jest.fn(async (items: MetricContributionDomainEntity[]) => {
        created.push(...items);
        return items;
      }),
      sumIssueDoneDeltaByIssueAndMetric: jest.fn(),
    };

    service = new ComponentMetricService(
      {} as ComponentMetricRepository,
      {} as MeasureRepository,
      bindingRepository as unknown as IssueMetricBindingRepository,
      contributionRepository as unknown as MetricContributionRepository,
      {} as ProjectRepository,
      {} as IssueRepository,
      {} as PermissionsService
    );
  });

  it('при переходе в DONE пишет вклады из bindings в журнал', async () => {
    (bindingRepository.findByIssueHash as jest.Mock).mockResolvedValue([
      makeBinding('metric-a', 3),
      makeBinding('metric-b', -1),
    ]);

    await service.handleIssueStatusTransition(
      'issue-1',
      IssueStatus.IN_PROGRESS,
      IssueStatus.DONE,
      'ant'
    );

    expect(contributionRepository.createMany).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(2);
    expect(created[0].metric_hash).toBe('metric-a');
    expect(created[0].delta).toBe(3);
    expect(created[0].source).toBe(MetricContributionSource.ISSUE_DONE);
    expect(created[0].username).toBe('ant');
    expect(created[1].metric_hash).toBe('metric-b');
    expect(created[1].delta).toBe(-1);
    expect(created[1].source).toBe(MetricContributionSource.ISSUE_DONE);
  });

  it('при уходе из DONE пишет compensating reverse на чистый вклад', async () => {
    (bindingRepository.findByIssueHash as jest.Mock).mockResolvedValue([
      makeBinding('metric-a', 3),
    ]);
    (contributionRepository.sumIssueDoneDeltaByIssueAndMetric as jest.Mock).mockResolvedValue(3);

    await service.handleIssueStatusTransition(
      'issue-1',
      IssueStatus.DONE,
      IssueStatus.IN_PROGRESS,
      'ant'
    );

    expect(created).toHaveLength(1);
    expect(created[0].delta).toBe(-3);
    expect(created[0].source).toBe(MetricContributionSource.ISSUE_REOPEN);
    expect(created[0].metric_hash).toBe('metric-a');
  });

  it('не пишет журнал если bindings пусты', async () => {
    (bindingRepository.findByIssueHash as jest.Mock).mockResolvedValue([]);

    await service.handleIssueStatusTransition(
      'issue-1',
      IssueStatus.IN_PROGRESS,
      IssueStatus.DONE,
      'ant'
    );

    expect(contributionRepository.createMany).not.toHaveBeenCalled();
  });

  it('не пишет журнал при смене статуса без DONE', async () => {
    await service.handleIssueStatusTransition(
      'issue-1',
      IssueStatus.BACKLOG,
      IssueStatus.IN_PROGRESS,
      'ant'
    );

    expect(bindingRepository.findByIssueHash).not.toHaveBeenCalled();
    expect(contributionRepository.createMany).not.toHaveBeenCalled();
  });

  it('при reopen с net=0 не пишет reverse', async () => {
    (bindingRepository.findByIssueHash as jest.Mock).mockResolvedValue([
      makeBinding('metric-a', 3),
    ]);
    (contributionRepository.sumIssueDoneDeltaByIssueAndMetric as jest.Mock).mockResolvedValue(0);

    await service.handleIssueStatusTransition(
      'issue-1',
      IssueStatus.DONE,
      IssueStatus.BACKLOG,
      'ant'
    );

    expect(created).toHaveLength(0);
    expect(contributionRepository.createMany).toHaveBeenCalledWith([]);
  });
});

describe('ComponentMetricService.setIssueMetricBindings (562-34)', () => {
  it('бросает ошибку при изменении привязок у задачи в DONE', async () => {
    const issueRepository = {
      findByIssueHash: jest.fn().mockResolvedValue({
        issue_hash: 'issue-1',
        project_hash: 'project-1',
        status: IssueStatus.DONE,
      }),
    };
    const projectRepository = {
      findByHash: jest.fn().mockResolvedValue({ project_hash: 'project-1' }),
    };
    const permissionsService = {
      calculateProjectPermissions: jest.fn().mockResolvedValue({ can_manage_issues: true }),
      calculateIssuePermissions: jest.fn().mockResolvedValue({ can_edit_issue: true }),
    };
    const bindingRepository = {
      replaceForIssue: jest.fn(),
    };

    const service = new ComponentMetricService(
      {} as ComponentMetricRepository,
      {} as MeasureRepository,
      bindingRepository as unknown as IssueMetricBindingRepository,
      {} as MetricContributionRepository,
      projectRepository as unknown as ProjectRepository,
      issueRepository as unknown as IssueRepository,
      permissionsService as unknown as PermissionsService
    );

    await expect(
      service.setIssueMetricBindings(
        {
          issue_hash: 'issue-1',
          bindings: [{ metric_hash: 'metric-a', delta: 5 }],
        },
        { username: 'ant' } as never
      )
    ).rejects.toThrow(/выполненной задачи/);

    expect(bindingRepository.replaceForIssue).not.toHaveBeenCalled();
  });
});
