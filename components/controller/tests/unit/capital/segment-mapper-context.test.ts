/**
 * Unit-тесты контекста проекта в доле участника.
 *
 * Что здесь защищается. Доли читаются списком сразу по всем проектам пайщика,
 * и без названия проекта строка такого списка неопознаваема. Поэтому контекст
 * (название компонента, название и хэш родителя, статус, признак отданного
 * голоса) кладётся прямо в долю.
 *
 * Две тонкости, ради которых и написаны тесты:
 *   • у проекта верхнего уровня родителя нет — его название и хэш обязаны быть
 *     пустыми, именно по ним компонент и отличается от проекта;
 *   • признак голоса заполняется только на путях чтения списков, а поле
 *     обязательное — на остальных путях оно обязано приходить отрицательным,
 *     а не пустым, иначе ответ уронит валидация целиком.
 *
 * Реестр случаев: test-registry/capital.results-desk.yaml
 */

import { SegmentMapper } from '~/extensions/capital/infrastructure/mappers/segment.mapper';

function makeMapper() {
  const contributorRepository = {
    findByUsernameAndCoopname: jest.fn(async () => ({ display_name: 'Пайщица' })),
  };
  const appendixRepository = {
    findConfirmedByUsernameAndProjectHash: jest.fn(async () => null),
  };
  const documentPort = { getByHash: jest.fn(async () => null) };

  return new SegmentMapper(documentPort as never, contributorRepository as never, appendixRepository as never);
}

/** Минимальная запись доли из базы: только то, что читает маппер. */
function makeEntity(overrides: Record<string, any> = {}) {
  return {
    coopname: 'coop',
    username: 'alice',
    project_hash: 'component-hash',
    project: { title: 'Компонент MVP', status: 'active' },
    parent_title: 'Мета-проект',
    parent_hash: 'parent-hash',
    has_voted: true,
    voting_completed: false,
    ...overrides,
  } as any;
}

describe('SegmentMapper.toDomain — контекст проекта в доле', () => {
  it('cap.resdesk.happy.06: доля приходит с названием компонента, родителем, статусом и признаком голоса', () => {
    const domain = SegmentMapper.toDomain(makeEntity());

    expect(domain.project_title).toBe('Компонент MVP');
    expect(domain.project_status).toBe('active');
    expect(domain.parent_title).toBe('Мета-проект');
    expect(domain.parent_hash).toBe('parent-hash');
    expect(domain.has_voted).toBe(true);
  });

  it('cap.resdesk.side.09: у проекта верхнего уровня название заполнено, а родитель пуст', () => {
    const domain = SegmentMapper.toDomain(
      makeEntity({ project: { title: 'Проект верхнего уровня', status: 'active' }, parent_title: undefined, parent_hash: undefined })
    );

    // Именно по пустому родителю проект верхнего уровня и отличается от
    // компонента: само название при этом обязано остаться.
    expect(domain.project_title).toBe('Проект верхнего уровня');
    expect(domain.parent_title).toBeUndefined();
    expect(domain.parent_hash).toBeUndefined();
  });
});

describe('SegmentMapper.toDTO — обязательные поля ответа', () => {
  it('cap.resdesk.side.11: на путях без контекста признак голоса приходит отрицательным, а не пустым', async () => {
    const mapper = makeMapper();
    // Доля, прочитанная там, где контекст не заполняется вовсе.
    const domain = SegmentMapper.toDomain(
      makeEntity({ has_voted: undefined, voting_completed: undefined, project: undefined, parent_title: undefined, parent_hash: undefined })
    );

    const dto = await mapper.toDTO(domain);

    // Поле обязательное: пустое значение уронило бы ответ целиком, поэтому
    // отсутствие записи о голосе равнозначно «не голосовал».
    expect(dto.has_voted).toBe(false);
    expect(dto.voting_completed).toBe(false);
  });

  it('заполненный признак голоса не перетирается значением по умолчанию', async () => {
    const mapper = makeMapper();
    const domain = SegmentMapper.toDomain(makeEntity({ has_voted: true, voting_completed: true }));

    const dto = await mapper.toDTO(domain);

    expect(dto.has_voted).toBe(true);
    expect(dto.voting_completed).toBe(true);
  });
});
