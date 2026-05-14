import { OnboardingStepsRegistryService } from '~/domain/onboarding/services/onboarding-steps-registry.service';

describe('OnboardingStepsRegistryService', () => {
  let registry: OnboardingStepsRegistryService;

  beforeEach(() => {
    registry = new OnboardingStepsRegistryService();
  });

  it('regsiterStep сохраняет спецификацию и возвращает её через getStep', () => {
    registry.registerStep({
      extension_name: 'stol_zakazov',
      step_key: 'public_offer',
      event_type: 'SOVIET_DECISION',
      vars_field: 'public_offer',
      generator: 'free_decision',
      order: 10,
    });

    const spec = registry.getStep('stol_zakazov', 'public_offer');
    expect(spec).not.toBeNull();
    expect(spec?.vars_field).toBe('public_offer');
  });

  it('getStepsByExtension возвращает шаги в порядке order', () => {
    registry.registerStep({
      extension_name: 'demo',
      step_key: 'second',
      event_type: 'SOVIET_DECISION',
      vars_field: 'second',
      generator: 'free_decision',
      order: 20,
    });
    registry.registerStep({
      extension_name: 'demo',
      step_key: 'first',
      event_type: 'SOVIET_DECISION',
      vars_field: 'first',
      generator: 'free_decision',
      order: 10,
    });
    registry.registerStep({
      extension_name: 'other',
      step_key: 'irrelevant',
      event_type: 'SOVIET_DECISION',
      vars_field: 'irrelevant',
      generator: 'free_decision',
      order: 5,
    });

    const steps = registry.getStepsByExtension('demo');
    expect(steps.map((s) => s.step_key)).toEqual(['first', 'second']);
  });

  it('повторная регистрация той же пары (extension_name, step_key) бросает Error', () => {
    registry.registerStep({
      extension_name: 'demo',
      step_key: 'dup',
      event_type: 'SOVIET_DECISION',
      vars_field: 'dup',
      generator: 'free_decision',
      order: 1,
    });

    expect(() =>
      registry.registerStep({
        extension_name: 'demo',
        step_key: 'dup',
        event_type: 'SOVIET_DECISION',
        vars_field: 'dup_v2',
        generator: 'free_decision',
        order: 2,
      })
    ).toThrow(/уже зарегистрирован/);
  });

  it('unregisterStepsByExtension чистит только шаги указанного расширения', () => {
    registry.registerStep({
      extension_name: 'a',
      step_key: 's1',
      event_type: 'SOVIET_DECISION',
      vars_field: 's1',
      generator: 'free_decision',
      order: 1,
    });
    registry.registerStep({
      extension_name: 'b',
      step_key: 's1',
      event_type: 'SOVIET_DECISION',
      vars_field: 's1',
      generator: 'free_decision',
      order: 1,
    });

    registry.unregisterStepsByExtension('a');

    expect(registry.getStep('a', 's1')).toBeNull();
    expect(registry.getStep('b', 's1')).not.toBeNull();
  });

  it('getStep возвращает null для незнакомой пары', () => {
    expect(registry.getStep('unknown', 'unknown')).toBeNull();
  });
});
