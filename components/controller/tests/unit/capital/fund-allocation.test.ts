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
