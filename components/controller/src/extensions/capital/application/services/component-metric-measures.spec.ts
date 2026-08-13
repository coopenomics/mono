import { ComponentMetricService } from './component-metric.service';
import { MeasureDomainEntity } from '../../domain/entities/measure.entity';
import { MetricSeriesMode } from '../../domain/enums/metric-series-mode.enum';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import type { ComponentMetricRepository } from '../../domain/repositories/component-metric.repository';
import type { MeasureRepository } from '../../domain/repositories/measure.repository';
import type { IssueMetricBindingRepository } from '../../domain/repositories/issue-metric-binding.repository';
import type { MetricContributionRepository } from '../../domain/repositories/metric-contribution.repository';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { IssueRepository } from '../../domain/repositories/issue.repository';
import type { PermissionsService } from './permissions.service';

/**
 * Меры кооператива заводятся текстом по ходу планирования:
 * общего справочника нет, дубли по паре название+единица не плодятся.
 */
class InMemoryMeasureRepository implements MeasureRepository {
  public readonly items: MeasureDomainEntity[] = [];
  public createCalls = 0;
  private seq = 0;

  async create(measure: MeasureDomainEntity): Promise<MeasureDomainEntity> {
    this.createCalls += 1;
    measure._id = `measure-${++this.seq}`;
    this.items.push(measure);
    return measure;
  }

  async findByMeasureHash(measureHash: string): Promise<MeasureDomainEntity | null> {
    return this.items.find((m) => m.measure_hash === measureHash.toLowerCase()) ?? null;
  }

  async findByCoopnameAndTitleUnit(
    coopname: string,
    title: string,
    unit: string,
    status?: MetricStatus
  ): Promise<MeasureDomainEntity | null> {
    return (
      this.items.find(
        (m) =>
          m.coopname === coopname &&
          m.title === title.trim() &&
          m.unit === unit.trim() &&
          (status ? m.status === status : true)
      ) ?? null
    );
  }

  async findByCoopname(coopname: string, status?: MetricStatus): Promise<MeasureDomainEntity[]> {
    return this.items.filter(
      (m) => m.coopname === coopname && (status ? m.status === status : true)
    );
  }

  async findByMeasureHashes(measureHashes: string[]): Promise<MeasureDomainEntity[]> {
    const set = new Set(measureHashes.map((h) => h.toLowerCase()));
    return this.items.filter((m) => set.has(m.measure_hash));
  }

  async update(measure: MeasureDomainEntity): Promise<MeasureDomainEntity> {
    const index = this.items.findIndex((m) => m._id === measure._id);
    if (index >= 0) {
      this.items[index] = measure;
    }
    return measure;
  }
}

const currentUser = { username: 'ant' } as never;

function makeMeasure(
  repo: InMemoryMeasureRepository,
  overrides: Partial<{
    measure_hash: string;
    coopname: string;
    title: string;
    unit: string;
    status: MetricStatus;
  }> = {}
): MeasureDomainEntity {
  const measure = new MeasureDomainEntity({
    _id: '',
    measure_hash: overrides.measure_hash ?? 'measure-existing',
    coopname: overrides.coopname ?? 'voskhod',
    title: overrides.title ?? 'Ролики',
    unit: overrides.unit ?? 'шт',
    series_mode: MetricSeriesMode.RATE,
    created_by: 'ant',
    status: overrides.status ?? MetricStatus.ACTIVE,
    present: false,
    block_num: 0,
  });
  repo.items.push(measure);
  return measure;
}

function makeService(measureRepository: InMemoryMeasureRepository) {
  const created: Array<{ measure_hash: string; target_value: number }> = [];
  const stored = new Map<string, Record<string, unknown>>();

  const metricRepository = {
    create: jest.fn(async (metric) => {
      created.push({ measure_hash: metric.measure_hash, target_value: metric.target_value });
      stored.set(metric.metric_hash, metric);
      return metric;
    }),
    update: jest.fn(async (metric) => {
      stored.set(metric.metric_hash, metric);
      return metric;
    }),
    findByMetricHash: jest.fn(async (hash: string) => stored.get(hash) ?? null),
  };
  const projectRepository = {
    findByHash: jest.fn(async () => ({ project_hash: 'project-1', origin: 'local' })),
  };
  const permissionsService = {
    calculateProjectPermissions: jest.fn(async () => ({
      can_manage_issues: true,
      can_edit_project: true,
      can_view_artifacts: true,
    })),
  };
  const contributionRepository = {
    sumDeltaByMetricHash: jest.fn(async () => 0),
  };

  const service = new ComponentMetricService(
    metricRepository as unknown as ComponentMetricRepository,
    measureRepository,
    {} as IssueMetricBindingRepository,
    contributionRepository as unknown as MetricContributionRepository,
    projectRepository as unknown as ProjectRepository,
    {} as IssueRepository,
    permissionsService as unknown as PermissionsService
  );

  return { service, created, stored, metricRepository };
}

describe('ComponentMetricService — меры кооператива', () => {
  it('создание цели с мерой текстом заводит меру у кооператива', async () => {
    const measures = new InMemoryMeasureRepository();
    const { service } = makeService(measures);

    const metric = await service.createMetric(
      {
        coopname: 'voskhod',
        project_hash: 'project-1',
        title: '  Ролики  ',
        unit: ' шт ',
        target_value: 12,
      },
      currentUser
    );

    expect(measures.createCalls).toBe(1);
    expect(measures.items[0].title).toBe('Ролики');
    expect(measures.items[0].unit).toBe('шт');
    expect(measures.items[0].created_by).toBe('ant');
    expect(metric.title).toBe('Ролики');
    expect(metric.measure_hash).toBe(measures.items[0].measure_hash);
  });

  it('та же мера во второй цели не плодит дубль в коллекции', async () => {
    const measures = new InMemoryMeasureRepository();
    const { service } = makeService(measures);

    await service.createMetric(
      { coopname: 'voskhod', project_hash: 'project-1', title: 'Ролики', unit: 'шт', target_value: 5 },
      currentUser
    );
    await service.createMetric(
      { coopname: 'voskhod', project_hash: 'project-1', title: 'Ролики', unit: 'шт', target_value: 9 },
      currentUser
    );

    expect(measures.createCalls).toBe(1);
    expect(measures.items).toHaveLength(1);
  });

  it('мера без названия — отказ', async () => {
    const measures = new InMemoryMeasureRepository();
    const { service } = makeService(measures);

    await expect(
      service.createMetric(
        { coopname: 'voskhod', project_hash: 'project-1', target_value: 5 },
        currentUser
      )
    ).rejects.toThrow(/Укажите меру/);
    expect(measures.createCalls).toBe(0);
  });

  it('мера без единицы измерения — отказ', async () => {
    const measures = new InMemoryMeasureRepository();
    const { service } = makeService(measures);

    await expect(
      service.createMetric(
        {
          coopname: 'voskhod',
          project_hash: 'project-1',
          title: 'Ролики',
          unit: '   ',
          target_value: 5,
        },
        currentUser
      )
    ).rejects.toThrow(/единицу измерения/);
    expect(measures.createCalls).toBe(0);
  });

  it('чужая мера по хешу к цели не привязывается', async () => {
    const measures = new InMemoryMeasureRepository();
    makeMeasure(measures, { measure_hash: 'alien', coopname: 'othercoop' });
    const { service } = makeService(measures);

    await expect(
      service.createMetric(
        {
          coopname: 'voskhod',
          project_hash: 'project-1',
          measure_hash: 'alien',
          target_value: 5,
        },
        currentUser
      )
    ).rejects.toThrow(/другому кооперативу/);
  });

  it('выключенная мера при повторном использовании включается обратно', async () => {
    const measures = new InMemoryMeasureRepository();
    makeMeasure(measures, { status: MetricStatus.ARCHIVED });
    const { service } = makeService(measures);

    await service.createMetric(
      { coopname: 'voskhod', project_hash: 'project-1', title: 'Ролики', unit: 'шт', target_value: 3 },
      currentUser
    );

    expect(measures.createCalls).toBe(0);
    expect(measures.items[0].status).toBe(MetricStatus.ACTIVE);
  });

  it('смена названия в цели заводит новую меру, а старую не переименовывает', async () => {
    const measures = new InMemoryMeasureRepository();
    const { service } = makeService(measures);

    const metric = await service.createMetric(
      { coopname: 'voskhod', project_hash: 'project-1', title: 'Ролики', unit: 'шт', target_value: 5 },
      currentUser
    );
    const updated = await service.updateMetric(
      { metric_hash: metric.metric_hash, title: 'Статьи', unit: 'шт' },
      currentUser
    );

    expect(measures.items).toHaveLength(2);
    expect(measures.items[0].title).toBe('Ролики');
    expect(updated.title).toBe('Статьи');
    expect(updated.measure_hash).toBe(measures.items[1].measure_hash);
  });

  it('переименование меры в уже существующую пару — отказ', async () => {
    const measures = new InMemoryMeasureRepository();
    makeMeasure(measures, { measure_hash: 'm-1', title: 'Ролики' });
    makeMeasure(measures, { measure_hash: 'm-2', title: 'Статьи' });
    const { service } = makeService(measures);

    await expect(
      service.updateMeasure({ measure_hash: 'm-2', title: 'Ролики' }, currentUser)
    ).rejects.toThrow(/уже есть/);
  });

  it('список мер отдаёт только заведённые кооперативом, без общего справочника', async () => {
    const measures = new InMemoryMeasureRepository();
    makeMeasure(measures, { measure_hash: 'm-own', title: 'Ролики' });
    makeMeasure(measures, { measure_hash: 'm-alien', coopname: 'othercoop', title: 'Чужая' });
    const { service } = makeService(measures);

    const list = await service.getMeasures('voskhod', undefined, currentUser);

    expect(measures.createCalls).toBe(0);
    expect(list.map((m) => m.title)).toEqual(['Ролики']);
  });
});
