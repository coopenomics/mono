/**
 * Согласованность ключей подключения расширений (C28-42, случай 17.09.2026).
 *
 * Утверждение документа идёт двумя входами — из карточки подключения программы
 * и со вкладки «Шаблоны документов». Оба кладут в событие о решении совета один
 * и тот же ключ шага: имя пакета документов (`bundle`). Закрыть шаг подключения
 * может только приёмник, который этот ключ узнаёт.
 *
 * Ключи разъехались один раз: Положение «Генератора» объявлено пакетом
 * `generator_program`, а приёмник capital знал только прежнее имя шага
 * `generator_program_template`. Решение совета не засчитывалось, подключение
 * оставалось незавершённым, и программы capital не попадали во вступление —
 * при том что карточка подключения показывала шаг закрытым (она сверяется с
 * утверждением в цепи).
 *
 * Тест берёт пакеты из самих объявлений документов, поэтому новый документ с
 * утверждением советом не пройдёт мимо: либо приёмник его узнаёт, либо пакет
 * осознанно вписан в исключения ниже.
 */
import type { InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { registerCapitalDocuments } from '~/extensions/capital/application/onboarding/register-capital-documents';
import { registerMarketplaceDocuments } from '~/extensions/marketplace/application/onboarding/register-marketplace-documents';
import { CORE_DOCUMENT_DECLARATIONS } from '~/domain/document-approval/constants/core-document-declarations';
import { CapitalOnboardingEventsService } from '~/extensions/capital/application/services/onboarding-events.service';
import { ChairmanOnboardingEventsService } from '~/extensions/chairman/application/services/onboarding-events.service';
import { ExtensionOnboardingEventsService } from '~/domain/onboarding/services/extension-onboarding-events.service';
import { OnboardingStepsRegistryService } from '~/domain/onboarding/services/onboarding-steps-registry.service';
import { registerMarketplaceOnboardingSteps } from '~/extensions/marketplace/application/onboarding/register-marketplace-onboarding-steps';

function makeLoggerStub() {
  return { setContext: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() } as any;
}

function makeRepoStub(name: string) {
  const extension = { name, config: {} as Record<string, unknown> } as any;
  return {
    findByName: jest.fn(async () => extension),
    patchConfig: jest.fn(async (_name: string, patch: Record<string, unknown>) => {
      Object.assign(extension.config, patch);
      return extension;
    }),
  };
}

async function declarationsOf(
  register: (port: any) => Promise<void>
): Promise<InnerDocumentDeclaration[]> {
  const declared: InnerDocumentDeclaration[] = [];
  await register({
    unregisterByExtension: jest.fn(async () => undefined),
    registerDocuments: jest.fn(async (docs: InnerDocumentDeclaration[]) => {
      declared.push(...docs);
    }),
  });
  return declared;
}

/** Пакеты, утверждение которых закрывает шаг подключения: у них есть поле реквизитов протокола. */
const stepBundles = (declarations: InnerDocumentDeclaration[]): string[] => [
  ...new Set(
    declarations
      .filter((d) => d.approval === 'required' && d.bundle && d.vars_field)
      .map((d) => d.bundle as string)
  ),
];

const trackedEvent = (extension: string, step: string) =>
  ({ result: { metadata: { onboarding_step: step, extension }, decision_id: '1', vars_field: step } } as any);

describe('ключи подключения: пакет документов узнаётся приёмником решения', () => {
  it('capital: каждое утверждение закрывает свой шаг', async () => {
    const bundles = stepBundles(await declarationsOf(registerCapitalDocuments));
    expect(bundles.length).toBe(5);

    for (const bundle of bundles) {
      const repo = makeRepoStub('capital');
      const service = new CapitalOnboardingEventsService(
        repo as any,
        undefined as any,
        undefined as any,
        makeLoggerStub(),
        { emit: jest.fn() } as any
      );

      await service.handleDecisionTracked(trackedEvent('capital', bundle));

      expect({ bundle, flags: repo.patchConfig.mock.calls.length }).toEqual({ bundle, flags: 1 });
    }
  });

  it('chairman: каждое утверждение документа ядра закрывает свой шаг', async () => {
    // Оферту о присоединении к платформе (50) утверждает только совет оператора,
    // шага подключения кооператива за ней нет.
    const NOT_A_STEP = ['coopenomics_agreement'];
    const bundles = stepBundles(CORE_DOCUMENT_DECLARATIONS).filter((b) => !NOT_A_STEP.includes(b));
    expect(bundles.length).toBeGreaterThanOrEqual(5);

    for (const bundle of bundles) {
      const repo = makeRepoStub('chairman');
      const service = new ChairmanOnboardingEventsService(repo as any, makeLoggerStub(), { emit: jest.fn() } as any);

      await service.handleDecisionTracked(trackedEvent('chairman', bundle));

      expect({ bundle, flags: repo.patchConfig.mock.calls.length }).toEqual({ bundle, flags: 1 });
    }
  });

  it('Стол заказов: у каждого пакета есть шаг с тем же ключом, общий приёмник ставит его флаг', async () => {
    const bundles = stepBundles(await declarationsOf(registerMarketplaceDocuments));
    expect(bundles.length).toBe(2);

    const steps = new OnboardingStepsRegistryService();
    registerMarketplaceOnboardingSteps(steps as any);

    for (const bundle of bundles) {
      expect(steps.getStep('market', bundle)).toBeTruthy();

      const repo = makeRepoStub('market');
      const service = new ExtensionOnboardingEventsService(
        repo as any,
        steps as any,
        makeLoggerStub(),
        { emit: jest.fn() } as any
      );

      await service.handleDecisionTracked(trackedEvent('market', bundle));

      expect(repo.patchConfig).toHaveBeenCalledWith('market', { [`onboarding_${bundle}_done`]: true });
    }
  });
});
