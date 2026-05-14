/**
 * Unit-тесты CapitalOnboardingEventsService.handleDecisionTracked (Эпик 1.2).
 *
 * Фокус — эмит ONBOARDING_COMPLETED_EVENT, когда последний _done флаг L1
 * капитала переходит false → true. Идемпотентность по `wasAlreadyDone`
 * гарантирует, что повторный приход того же blockchain-события не
 * эмиттит лишний restart.
 */

import { CapitalOnboardingEventsService } from '~/extensions/capital/application/services/onboarding-events.service';
import { ONBOARDING_COMPLETED_EVENT } from '~/domain/onboarding/events/onboarding-completed.event';

function makeLoggerStub() {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

function makeRepoStub(cfg: Record<string, any>) {
  const plugin = { name: 'capital', config: { ...cfg } } as any;
  return {
    findByName: jest.fn(async () => plugin),
    update: jest.fn(async (next: any) => {
      Object.assign(plugin.config, next.config);
    }),
  };
}

function makeEmitterStub() {
  return { emit: jest.fn() } as any;
}

function makeService(repo: any, emitter: any) {
  return new CapitalOnboardingEventsService(
    repo,
    undefined as any, // contributorRepository
    undefined as any, // accountDataPort
    makeLoggerStub(),
    emitter
  );
}

function trackedEvent(step: string) {
  return {
    result: {
      metadata: { onboarding_step: step, extension: 'capital' },
      decision_id: '1',
      vars_field: 'x',
    },
  } as any;
}

describe('CapitalOnboardingEventsService.handleDecisionTracked', () => {
  it('эмиттит ONBOARDING_COMPLETED_EVENT когда последний из 5 _done встаёт', async () => {
    const repo = makeRepoStub({
      onboarding_generator_program_template_done: true,
      onboarding_generation_contract_template_done: true,
      onboarding_generator_offer_template_done: true,
      onboarding_blagorost_provision_done: true,
      onboarding_blagorost_offer_template_done: false,
    });
    const emitter = makeEmitterStub();
    const service = makeService(repo, emitter);

    await service.handleDecisionTracked(trackedEvent('blagorost_offer_template'));

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith(ONBOARDING_COMPLETED_EVENT, {
      extension_name: 'capital',
    });
  });

  it('НЕ эмиттит, если ставится не последний _done (остался хотя бы один false)', async () => {
    const repo = makeRepoStub({
      onboarding_generator_program_template_done: false,
      onboarding_generation_contract_template_done: false,
      onboarding_generator_offer_template_done: false,
      onboarding_blagorost_provision_done: false,
      onboarding_blagorost_offer_template_done: false,
    });
    const emitter = makeEmitterStub();
    const service = makeService(repo, emitter);

    await service.handleDecisionTracked(trackedEvent('generator_program_template'));

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('НЕ эмиттит повторно, если этот _done уже стоял (idempotency повторного события)', async () => {
    const repo = makeRepoStub({
      onboarding_generator_program_template_done: true,
      onboarding_generation_contract_template_done: true,
      onboarding_generator_offer_template_done: true,
      onboarding_blagorost_provision_done: true,
      onboarding_blagorost_offer_template_done: true, // уже стоял
    });
    const emitter = makeEmitterStub();
    const service = makeService(repo, emitter);

    await service.handleDecisionTracked(trackedEvent('blagorost_offer_template'));

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('игнорирует событие другого расширения', async () => {
    const repo = makeRepoStub({});
    const emitter = makeEmitterStub();
    const service = makeService(repo, emitter);

    const event = {
      result: {
        metadata: { onboarding_step: 'wallet_agreement', extension: 'chairman' },
        decision_id: '1',
        vars_field: 'x',
      },
    } as any;
    await service.handleDecisionTracked(event);

    expect(repo.findByName).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
