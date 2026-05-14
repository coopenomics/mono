/**
 * Unit-тесты registerCapitalInAgreementRegistry (Эпик 1.2).
 *
 * Тест чистой функции — не тянет за собой импорт CapitalPlugin
 * (там цепочка с @octokit/rest ESM, которая ломает jest-transform).
 *
 * Покрывают:
 *   (a) L1 не завершён (хотя бы один _done = false) → port не вызывается,
 *       функция возвращает false;
 *   (b) L1 завершён → 2 registerAgreement (generator_offer registry_id 996,
 *       blagorost_offer registry_id 1000) + 2 registerProgram (generation
 *       → ['generator_offer'], capitalization → ['blagorost_offer']),
 *       функция возвращает true;
 *   (c) повторный вызов делает те же register-вызовы (реальная
 *       идемпотентность гарантируется AgreementRegistryService).
 */

import { Cooperative } from 'cooptypes';
import { registerCapitalInAgreementRegistry } from '~/extensions/capital/application/registration/register-capital-in-agreement-registry';

const baseConfig = {
  onboarding_generator_program_template_done: false,
  onboarding_generation_contract_template_done: false,
  onboarding_generator_offer_template_done: false,
  onboarding_blagorost_provision_done: false,
  onboarding_blagorost_offer_template_done: false,
} as any;

const allDoneConfig = {
  onboarding_generator_program_template_done: true,
  onboarding_generation_contract_template_done: true,
  onboarding_generator_offer_template_done: true,
  onboarding_blagorost_provision_done: true,
  onboarding_blagorost_offer_template_done: true,
} as any;

function makePortStub() {
  return {
    registerAgreement: jest.fn(),
    unregisterAgreement: jest.fn(),
    registerProgram: jest.fn(),
    unregisterProgram: jest.fn(),
  };
}

describe('registerCapitalInAgreementRegistry', () => {
  it('возвращает false и не вызывает port если все _done = false', () => {
    const port = makePortStub();

    const ok = registerCapitalInAgreementRegistry(port as any, baseConfig);

    expect(ok).toBe(false);
    expect(port.registerAgreement).not.toHaveBeenCalled();
    expect(port.registerProgram).not.toHaveBeenCalled();
  });

  it('возвращает false и не вызывает port если один _done = false', () => {
    const port = makePortStub();
    const cfg = { ...allDoneConfig, onboarding_blagorost_offer_template_done: false };

    const ok = registerCapitalInAgreementRegistry(port as any, cfg);

    expect(ok).toBe(false);
    expect(port.registerAgreement).not.toHaveBeenCalled();
    expect(port.registerProgram).not.toHaveBeenCalled();
  });

  it('регистрирует 2 оферты и 2 программы когда все 5 _done = true', () => {
    const port = makePortStub();

    const ok = registerCapitalInAgreementRegistry(port as any, allDoneConfig);

    expect(ok).toBe(true);
    expect(port.registerAgreement).toHaveBeenCalledTimes(2);
    expect(port.registerProgram).toHaveBeenCalledTimes(2);

    expect(port.registerAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generator_offer',
        registry_id: Cooperative.Registry.GeneratorOffer.registry_id,
        agreement_type: 'generator',
        extension_name: 'capital',
        applicable_account_types: [],
      })
    );

    expect(port.registerAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'blagorost_offer',
        registry_id: Cooperative.Registry.BlagorostOffer.registry_id,
        agreement_type: 'capital',
        extension_name: 'capital',
        // Пусто — оферта подтягивается через программу CAPITALIZATION,
        // не как дефолтная для individual (см. 8847a5c0939).
        applicable_account_types: [],
      })
    );

    expect(port.registerProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'GENERATION',
        agreement_ids: ['generator_offer'],
        extension_name: 'capital',
      })
    );

    expect(port.registerProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'CAPITALIZATION',
        agreement_ids: ['blagorost_offer'],
        extension_name: 'capital',
      })
    );
  });

  it('повторный вызов воспроизводит те же register-вызовы', () => {
    const port = makePortStub();

    registerCapitalInAgreementRegistry(port as any, allDoneConfig);
    registerCapitalInAgreementRegistry(port as any, allDoneConfig);

    expect(port.registerAgreement).toHaveBeenCalledTimes(4);
    expect(port.registerProgram).toHaveBeenCalledTimes(4);
  });
});
