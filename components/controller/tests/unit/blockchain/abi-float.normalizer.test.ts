import { normalizeAbiFloats } from '../../../src/infrastructure/blockchain/abi-float.normalizer';

/**
 * ABI повторяет форму таблицы capital/projects: вложенные структуры plan/fact с float64-полями.
 */
const abi = {
  tables: [{ name: 'projects', type: 'project' }],
  structs: [
    {
      name: 'project',
      base: '',
      fields: [
        { name: 'project_hash', type: 'checksum256' },
        { name: 'plan', type: 'plan_pool' },
        { name: 'fact', type: 'fact_pool' },
        { name: 'rates', type: 'float64[]' },
      ],
    },
    {
      name: 'plan_pool',
      base: '',
      fields: [
        { name: 'return_base_percent', type: 'float64' },
        { name: 'use_invest_percent', type: 'float64' },
        { name: 'creators_hours', type: 'uint64' },
        { name: 'total', type: 'asset' },
      ],
    },
    {
      name: 'fact_pool',
      base: 'plan_pool',
      fields: [{ name: 'accuracy', type: 'float32' }],
    },
  ],
};

describe('normalizeAbiFloats — float-поля таблиц блокчейна', () => {
  it('приводит float64 из вложенных структур к числам', () => {
    const row = {
      project_hash: 'e5990fe7',
      plan: { return_base_percent: '100.00000000000000000', use_invest_percent: '100', creators_hours: 20, total: '1.0000 RUB' },
      fact: { return_base_percent: '61.804697156983934', use_invest_percent: '100', creators_hours: 20, total: '1.0000 RUB', accuracy: '0.5' },
    };

    const result = normalizeAbiFloats(row, abi, 'projects');

    expect(result.plan.return_base_percent).toBe(100);
    expect(result.fact.return_base_percent).toBeCloseTo(61.804697156983934, 12);
    expect(typeof result.fact.use_invest_percent).toBe('number');
  });

  it('нормализует float-поля, унаследованные от базовой структуры', () => {
    const row = { fact: { return_base_percent: '12.5', accuracy: '0.25' } };

    const result = normalizeAbiFloats(row, abi, 'projects');

    expect(result.fact.return_base_percent).toBe(12.5);
    expect(result.fact.accuracy).toBe(0.25);
  });

  it('не трогает поля других типов', () => {
    const row = {
      project_hash: 'e5990fe7',
      plan: { return_base_percent: '1', creators_hours: 20, total: '60000.0000 RUB' },
    };

    const result = normalizeAbiFloats(row, abi, 'projects');

    expect(result.project_hash).toBe('e5990fe7');
    expect(result.plan.creators_hours).toBe(20);
    expect(result.plan.total).toBe('60000.0000 RUB');
  });

  it('обнуляет значения, которые не приводятся к конечному числу', () => {
    const row = { plan: { return_base_percent: 'nan', use_invest_percent: 'inf' } };

    const result = normalizeAbiFloats(row, abi, 'projects');

    expect(result.plan.return_base_percent).toBe(0);
    expect(result.plan.use_invest_percent).toBe(0);
  });

  it('обрабатывает массивы рядов и массивы float-полей', () => {
    const rows = [
      { plan: { return_base_percent: '1.5' }, rates: ['1.5', '2.5'] },
      { plan: { return_base_percent: '2.5' }, rates: [] },
    ];

    const result = normalizeAbiFloats(rows, abi, 'projects');

    expect(result[0].plan.return_base_percent).toBe(1.5);
    expect(result[0].rates).toEqual([1.5, 2.5]);
    expect(result[1].plan.return_base_percent).toBe(2.5);
  });

  it('возвращает значение как есть, если таблицы нет в ABI', () => {
    const row = { plan: { return_base_percent: '1.5' } };

    const result = normalizeAbiFloats(row, abi, 'segments');

    expect(result.plan.return_base_percent).toBe('1.5');
  });

  it('переносит null и undefined без изменений', () => {
    const row = { plan: { return_base_percent: null, use_invest_percent: undefined } };

    const result = normalizeAbiFloats(row, abi, 'projects');

    expect(result.plan.return_base_percent).toBeNull();
    expect(result.plan.use_invest_percent).toBeUndefined();
  });
});
