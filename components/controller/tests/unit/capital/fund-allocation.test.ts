/**
 * Unit-тесты направления средств программы в проект (allocate).
 *
 * Что здесь защищается. Контракт списывает деньги программы со свободного
 * остатка и записывает их проекту, проверяя только достаточность остатка — он
 * не знает ни про персональные проекты, ни про регистр хэша. Значит бэкенд
 * обязан сам отсечь персональный проект, привести хэш к нижнему регистру
 * (иначе проект в БД не найдётся и отказ будет ложным) и не пропустить сумму
 * в чужой валюте. Тесты фиксируют именно это, а не факт вызова порта.
 *
 * Реестр случаев: test-registry/capital.fund-allocation.yaml
 */

import { InvestsManagementInteractor } from '~/extensions/capital/application/use-cases/invests-management.interactor';
import { InvestsManagementService } from '~/extensions/capital/application/services/invests-management.service';
import { ProjectOrigin } from '~/extensions/capital/domain/enums/project-origin.enum';

function makeLoggerStub() {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

function makeInteractor(o: { project?: any } = {}) {
  const project =
    'project' in o ? o.project : { project_hash: 'ph', origin: ProjectOrigin.BLOCKCHAIN };

  const capitalBlockchainPort = {
    allocateFunds: jest.fn(async () => ({ transaction_id: 'tx-1' })),
  } as any;

  const projectRepository = {
    findByHash: jest.fn(async () => project),
  } as any;

  // Зависимости подставляются по порядку объявления в конструкторе, поэтому
  // каждая заглушка подписана: при добавлении новой зависимости в интерактор
  // сразу видно, на чьё место она встала. Безымянные заглушки уже один раз
  // сдвинули логгер и уронили сборку тестов.
  const interactor = new InvestsManagementInteractor(
    capitalBlockchainPort,
    {} as any, // investRepository
    {} as any, // appendixRepository
    {} as any, // contributorRepository
    projectRepository,
    {} as any, // segmentRepository
    {} as any, // domainToBlockchainUtils
    {} as any, // investSyncService
    makeLoggerStub()
  );

  return { interactor, capitalBlockchainPort, projectRepository };
}

function allocateInput(overrides: Record<string, any> = {}) {
  return {
    coopname: 'coop',
    project_hash: 'PH',
    amount: '1000.0000 RUB',
    ...overrides,
  } as any;
}

describe('InvestsManagementInteractor.allocateFunds', () => {
  // cap.alloc.happy.01
  it('передаёт в цепь кооператив, проект и сумму без изменений по существу', async () => {
    const { interactor, capitalBlockchainPort } = makeInteractor();

    await interactor.allocateFunds(allocateInput({ project_hash: 'ph' }));

    expect(capitalBlockchainPort.allocateFunds).toHaveBeenCalledWith({
      coopname: 'coop',
      project_hash: 'ph',
      amount: '1000.0000 RUB',
    });
  });

  // cap.alloc.side.01
  it('ищет проект и отправляет хэш в нижнем регистре', async () => {
    const { interactor, capitalBlockchainPort, projectRepository } = makeInteractor();

    await interactor.allocateFunds(allocateInput({ project_hash: 'PH' }));

    expect(projectRepository.findByHash).toHaveBeenCalledWith('ph');
    expect(capitalBlockchainPort.allocateFunds).toHaveBeenCalledWith(
      expect.objectContaining({ project_hash: 'ph' })
    );
  });

  // cap.alloc.side.02
  it('отклоняет персональный LOCAL-проект до обращения к цепи', async () => {
    const { interactor, capitalBlockchainPort } = makeInteractor({
      project: { project_hash: 'ph', origin: ProjectOrigin.LOCAL },
    });

    await expect(interactor.allocateFunds(allocateInput())).rejects.toThrow(/Персональный проект/);
    expect(capitalBlockchainPort.allocateFunds).not.toHaveBeenCalled();
  });

  // cap.alloc.side.03
  it('отклоняет несуществующий проект до обращения к цепи', async () => {
    const { interactor, capitalBlockchainPort } = makeInteractor({ project: null });

    await expect(interactor.allocateFunds(allocateInput())).rejects.toThrow('Проект не найден');
    expect(capitalBlockchainPort.allocateFunds).not.toHaveBeenCalled();
  });
});

describe('InvestsManagementService.allocateFunds', () => {
  function makeService(o: { interactorResult?: any } = {}) {
    const investsManagementInteractor = {
      allocateFunds: jest.fn(async () => o.interactorResult ?? { transaction_id: 'tx-1' }),
    } as any;

    const service = new InvestsManagementService(investsManagementInteractor, {} as any);

    return { service, investsManagementInteractor };
  }

  // cap.alloc.happy.02
  it('пропускает сумму в валюте кооператива', async () => {
    const { service, investsManagementInteractor } = makeService();

    await service.allocateFunds(allocateInput({ amount: '1000.0000 RUB' }));

    expect(investsManagementInteractor.allocateFunds).toHaveBeenCalled();
  });

  // cap.alloc.side.04
  it('отклоняет сумму в чужой валюте до доменного слоя', async () => {
    const { service, investsManagementInteractor } = makeService();

    await expect(service.allocateFunds(allocateInput({ amount: '1000.0000 USD' }))).rejects.toThrow();
    expect(investsManagementInteractor.allocateFunds).not.toHaveBeenCalled();
  });
});

// ── Возврат средств из компонента в программу ───────────────────────────────
//
// Контракт проверяет границу возврата сам, но интерфейсу нужно показать
// председателю потолок ДО отправки транзакции. Ошибка здесь дороже обычной:
// подсказанная сумма, которую контракт отклонит, выглядит как поломка
// кнопки. Поэтому расчёт предела вынесен в чистую функцию и проверяется на
// слепках, а не через порт.

function makeDeallocInteractor(o: { project?: any, segments?: any[] } = {}) {
  const project =
    'project' in o
      ? o.project
      : { project_hash: 'ph', origin: ProjectOrigin.BLOCKCHAIN, status: 'active', fact: {} };

  const capitalBlockchainPort = {
    deallocateFunds: jest.fn(async () => ({ transaction_id: 'tx-2' })),
  } as any;

  const projectRepository = { findByHash: jest.fn(async () => project) } as any;
  const segmentRepository = {
    findAllByProjectHash: jest.fn(async () => o.segments ?? []),
  } as any;

  const interactor = new InvestsManagementInteractor(
    capitalBlockchainPort,
    {} as any, // investRepository
    {} as any, // appendixRepository
    {} as any, // contributorRepository
    projectRepository,
    segmentRepository,
    {} as any, // domainToBlockchainUtils
    {} as any, // investSyncService
    makeLoggerStub()
  );

  return { interactor, capitalBlockchainPort, projectRepository, segmentRepository };
}

const deallocInput = (overrides: Record<string, any> = {}) =>
  ({ coopname: 'coop', project_hash: 'PH', amount: '1000.0000 RUB', ...overrides }) as any;

describe('InvestsManagementInteractor.deallocateFunds', () => {
  it('cap.dealloc.side.10: отклоняет персональный проект пайщика до обращения к цепи', async () => {
    const { interactor, capitalBlockchainPort } = makeDeallocInteractor({
      project: { project_hash: 'ph', origin: ProjectOrigin.LOCAL, status: 'active', fact: {} },
    });

    await expect(interactor.deallocateFunds(deallocInput())).rejects.toThrow();
    expect(capitalBlockchainPort.deallocateFunds).not.toHaveBeenCalled();
  });
});

describe('InvestsManagementService.deallocateFunds', () => {
  function makeService() {
    const investsManagementInteractor = { deallocateFunds: jest.fn(async () => ({ transaction_id: 'tx-2' })) } as any;
    const service = new InvestsManagementService(investsManagementInteractor, {} as any);
    return { service, investsManagementInteractor };
  }

  it('пропускает сумму в валюте кооператива', async () => {
    const { service, investsManagementInteractor } = makeService();
    await service.deallocateFunds(deallocInput());
    expect(investsManagementInteractor.deallocateFunds).toHaveBeenCalled();
  });

  it('cap.dealloc.side.11: отклоняет сумму в чужой валюте до доменного слоя', async () => {
    const { service, investsManagementInteractor } = makeService();
    await expect(service.deallocateFunds(deallocInput({ amount: '1000.0000 USD' }))).rejects.toThrow();
    expect(investsManagementInteractor.deallocateFunds).not.toHaveBeenCalled();
  });
});

describe('InvestsManagementInteractor.getDeallocationLimit', () => {
  it('cap.dealloc.happy.02: отдаёт предел и его составляющие в валюте кооператива', async () => {
    const { interactor } = makeDeallocInteractor({
      project: {
        project_hash: 'ph',
        origin: ProjectOrigin.BLOCKCHAIN,
        status: 'active',
        fact: {
          program_invest_pool: '30000.0000 RUB',
          invest_pool: '50000.0000 RUB',
          total_received_investments: '50000.0000 RUB',
          total_used_for_compensation: '5000.0000 RUB',
          used_expense_pool: '5000.0000 RUB',
        },
      },
    });

    const limit = await interactor.getDeallocationLimit(deallocInput());

    // Потолок — минимум из трёх границ: программные средства проекта (30 000),
    // неизрасходованное (50 000 − 5 000 − 5 000 = 40 000) и остаток после
    // удержания под ссуды (ссуд нет, поэтому весь инвестпул).
    expect(limit.program_invest_pool).toBe(30000);
    expect(limit.unspent).toBe(40000);
    expect(limit.outstanding_debt).toBe(0);
    expect(limit.max_amount).toBe(30000);
    expect(limit.is_allowed_by_status).toBe(true);
    expect(limit.symbol).toBe('RUB');
  });

  it('cap.dealloc.side.09: на проекте в голосовании потолок нулевой, а признак разрешённости отрицательный', async () => {
    const { interactor } = makeDeallocInteractor({
      project: {
        project_hash: 'ph',
        origin: ProjectOrigin.BLOCKCHAIN,
        status: 'voting',
        fact: {
          program_invest_pool: '30000.0000 RUB',
          invest_pool: '30000.0000 RUB',
          total_received_investments: '30000.0000 RUB',
        },
      },
    });

    const limit = await interactor.getDeallocationLimit(deallocInput());

    // Интерфейсу есть что показать вместо пустого поля: составляющие остаются
    // видимыми, нулём становится только сам потолок.
    expect(limit.max_amount).toBe(0);
    expect(limit.is_allowed_by_status).toBe(false);
    expect(limit.program_invest_pool).toBe(30000);
  });

  it('cap.dealloc.side.13: потолок считается по самому «дорогому» заёмщику, а не по сумме долгов', async () => {
    const { interactor } = makeDeallocInteractor({
      project: {
        project_hash: 'ph',
        origin: ProjectOrigin.BLOCKCHAIN,
        status: 'active',
        fact: {
          program_invest_pool: '100000.0000 RUB',
          invest_pool: '100000.0000 RUB',
          total_received_investments: '100000.0000 RUB',
          creators_base_pool: '10000.0000 RUB',
          authors_base_pool: '0.0000 RUB',
          coordinators_base_pool: '0.0000 RUB',
        },
      },
      segments: [
        // Доля долга к трудовой базе: 1000/10000 = 0.1
        { debt_amount: '1000.0000 RUB', creator_base: '10000.0000 RUB' },
        // А здесь 900/1000 = 0.9 — по этому заёмщику и считается граница
        { debt_amount: '900.0000 RUB', creator_base: '1000.0000 RUB' },
      ],
    });

    const limit = await interactor.getDeallocationLimit(deallocInput());

    // Удержать нужно workCosts × maxRatio = 10 000 × 0.9 = 9 000, поэтому
    // вернуть можно 100 000 − 9 000. Если бы считали по СУММЕ долгов (1 900),
    // потолок вышел бы выше, и контракт отклонил бы подсказанную сумму.
    expect(limit.outstanding_debt).toBe(1900);
    expect(limit.max_amount).toBe(91000);
  });
});
