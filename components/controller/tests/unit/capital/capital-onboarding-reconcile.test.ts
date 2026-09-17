/**
 * Сверка отметок подключения capital с утверждениями в цепи (C28-42, 17.09.2026).
 *
 * Отметки шагов в настройке расширения решают, завершено ли подключение и
 * предлагать ли программы capital вступающим. Ставит их приёмник решения совета,
 * но решение может пройти мимо него. Источник правды — утверждение в цепи:
 * сверка дописывает недостающие отметки, а не только показывает шаг закрытым.
 */
import { CapitalOnboardingService } from '~/extensions/capital/application/services/onboarding.service';
import { ONBOARDING_COMPLETED_EVENT } from '~/domain/onboarding/events/onboarding-completed.event';

const FLAGS = [
  'onboarding_generator_program_template_done',
  'onboarding_generation_contract_template_done',
  'onboarding_generator_offer_template_done',
  'onboarding_blagorost_provision_done',
  'onboarding_blagorost_offer_template_done',
];

const allFlags = (value: boolean) => Object.fromEntries(FLAGS.map((flag) => [flag, value]));

function makeRepo(config: Record<string, unknown>) {
  const extension = {
    name: 'capital',
    config: { onboarding_init_at: '2026-09-16T00:00:00.000Z', onboarding_expire_at: '2026-10-16T00:00:00.000Z', ...config },
  } as any;
  return {
    findByName: jest.fn(async () => extension),
    update: jest.fn(async () => extension),
    patchConfig: jest.fn(async (_name: string, patch: Record<string, unknown>) => {
      Object.assign(extension.config, patch);
      return extension;
    }),
  };
}

function makeService(repo: any, approvedBundles: string[]) {
  const approvals = { isStepApproved: jest.fn(async (_ext: string, bundle: string) => approvedBundles.includes(bundle)) };
  const emitter = { emit: jest.fn() };
  const logger = { setContext: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() };
  const service = new CapitalOnboardingService(
    repo,
    undefined as any,
    undefined as any,
    approvals as any,
    logger as any,
    emitter as any
  );
  return { service, approvals, emitter };
}

describe('CapitalOnboardingService.reconcileFlags', () => {
  it('все отметки стоят — в цепь не ходит и ничего не пишет', async () => {
    const repo = makeRepo(allFlags(true));
    const { service, approvals, emitter } = makeService(repo, []);

    await service.reconcileFlags();

    expect(approvals.isStepApproved).not.toHaveBeenCalled();
    expect(repo.patchConfig).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('последняя отметка не встала, а документ утверждён — дописывает её и объявляет подключение завершённым', async () => {
    const repo = makeRepo({ ...allFlags(true), onboarding_generator_program_template_done: false });
    const { service, approvals, emitter } = makeService(repo, ['generator_program']);

    const config = await service.reconcileFlags();

    // Сверка идёт по имени пакета документов, а не по имени шага.
    expect(approvals.isStepApproved).toHaveBeenCalledWith('capital', 'generator_program');
    expect(repo.patchConfig).toHaveBeenCalledWith('capital', { onboarding_generator_program_template_done: true });
    expect((config as any).onboarding_generator_program_template_done).toBe(true);
    expect(emitter.emit).toHaveBeenCalledWith(ONBOARDING_COMPLETED_EVENT, { extension_name: 'capital' });
  });

  it('дописана не последняя отметка — подключение завершённым не объявляется', async () => {
    const repo = makeRepo(allFlags(false));
    const { service, emitter } = makeService(repo, ['blagorost_program']);

    await service.reconcileFlags();

    expect(repo.patchConfig).toHaveBeenCalledWith('capital', { onboarding_blagorost_provision_done: true });
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('ничего не утверждено — отметки не трогает', async () => {
    const repo = makeRepo(allFlags(false));
    const { service, emitter } = makeService(repo, []);

    await service.reconcileFlags();

    expect(repo.patchConfig).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('getState показывает то же, что записано: шаг закрыт и отметка стоит', async () => {
    const repo = makeRepo({ ...allFlags(true), onboarding_generator_offer_template_done: false });
    const { service } = makeService(repo, ['generator_offer_template']);

    const state = await service.getState();

    expect(state.generator_offer_template_done).toBe(true);
    expect(repo.patchConfig).toHaveBeenCalledWith('capital', { onboarding_generator_offer_template_done: true });
  });
});
