/**
 * Цель компонента живёт в кооперативе узла. До 25.09.2026 кооператив цели
 * брался из ввода как есть, и цель можно было завести на чужой кооператив
 * (C28-80).
 */
import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { ComponentMetricService } from '~/extensions/capital/application/services/component-metric.service';

configurePlatformSettings({ coopname: 'voskhod', blockchain: {} } as any);

describe('цель компонента — только в своём кооперативе', () => {
  it('чужой кооператив во вводе — отказ 403 до обращения к базе', async () => {
    const projects = { findByHash: jest.fn() };
    const metrics = { create: jest.fn() };
    const service = new ComponentMetricService(metrics as any, {} as any, {} as any, {} as any, projects as any, {} as any, {} as any);

    const err = await service
      .createMetric({ coopname: 'othercoop', project_hash: 'p1', target_value: 10 } as any, { username: 'ivanov' } as any)
      .catch((e) => e);

    expect(err.code).toBe('CAPITAL_METRIC_FOREIGN_COOPERATIVE');
    expect(err.getStatus()).toBe(403);
    expect(projects.findByHash).not.toHaveBeenCalled();
    expect(metrics.create).not.toHaveBeenCalled();
  });
});
