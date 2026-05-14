/**
 * Unit-тесты ChairmanOnboardingEventsService.handleDecisionTracked (Эпик 1.2).
 *
 * Аналог теста capital — фокус на эмите ONBOARDING_COMPLETED_EVENT
 * только на переходе последнего из 7 _done флагов false → true.
 */

import { ChairmanOnboardingEventsService } from '~/extensions/chairman/application/services/onboarding-events.service';
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
  const plugin = { name: 'chairman', config: { ...cfg } } as any;
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
  return new ChairmanOnboardingEventsService(repo, makeLoggerStub(), emitter);
}

function trackedEvent(step: string) {
  return {
    result: {
      metadata: { onboarding_step: step, extension: 'chairman' },
      decision_id: '1',
      vars_field: 'x',
    },
  } as any;
}

describe('ChairmanOnboardingEventsService.handleDecisionTracked', () => {
  it('эмиттит ONBOARDING_COMPLETED_EVENT когда последний из 7 _done встаёт', async () => {
    const repo = makeRepoStub({
      onboarding_wallet_agreement_done: true,
      onboarding_signature_agreement_done: true,
      onboarding_privacy_agreement_done: true,
      onboarding_user_agreement_done: true,
      onboarding_participant_application_done: true,
      onboarding_voskhod_membership_done: true,
      onboarding_general_meet_done: false,
    });
    const emitter = makeEmitterStub();
    const service = makeService(repo, emitter);

    await service.handleDecisionTracked(trackedEvent('general_meet'));

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith(ONBOARDING_COMPLETED_EVENT, {
      extension_name: 'chairman',
    });
  });

  it('НЕ эмиттит на промежуточный шаг (остаются false-флаги)', async () => {
    const repo = makeRepoStub({
      onboarding_wallet_agreement_done: false,
      onboarding_signature_agreement_done: false,
      onboarding_privacy_agreement_done: false,
      onboarding_user_agreement_done: false,
      onboarding_participant_application_done: false,
      onboarding_voskhod_membership_done: false,
      onboarding_general_meet_done: false,
    });
    const emitter = makeEmitterStub();
    const service = makeService(repo, emitter);

    await service.handleDecisionTracked(trackedEvent('wallet_agreement'));

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('НЕ эмиттит повторно (idempotency: _done уже стоял)', async () => {
    const repo = makeRepoStub({
      onboarding_wallet_agreement_done: true,
      onboarding_signature_agreement_done: true,
      onboarding_privacy_agreement_done: true,
      onboarding_user_agreement_done: true,
      onboarding_participant_application_done: true,
      onboarding_voskhod_membership_done: true,
      onboarding_general_meet_done: true,
    });
    const emitter = makeEmitterStub();
    const service = makeService(repo, emitter);

    await service.handleDecisionTracked(trackedEvent('general_meet'));

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('игнорирует событие capital', async () => {
    const repo = makeRepoStub({});
    const emitter = makeEmitterStub();
    const service = makeService(repo, emitter);

    const event = {
      result: {
        metadata: { onboarding_step: 'blagorost_offer_template', extension: 'capital' },
        decision_id: '1',
        vars_field: 'x',
      },
    } as any;
    await service.handleDecisionTracked(event);

    expect(repo.findByName).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
